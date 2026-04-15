/**
 * Helpers used by `scripts/clone-prod-to-dev.ts` to selectively copy the
 * most recent file-storage blobs from prod to dev without paying the full
 * cost of `convex export --include-file-storage`.
 *
 * - `listRecentFileRefs` is a pure query and safe to call against prod.
 * - `getStorageUrl` returns a short-lived download URL for a storage id.
 * - `rewriteStorageRef` is a mutation the dev-side import uses to point a
 *   cloned row at the freshly uploaded dev storage id.
 *
 * None of these helpers require auth — the clone script is the only
 * intended caller. If we ever need to harden them we can layer a shared
 * secret env var on top without changing the script surface.
 */

import { query, mutation } from './functions'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'

// Every table → list of field paths that hold _storage ids. Nested array
// fields are listed with the `[]` suffix so the helper knows to iterate.
const FILE_REF_FIELDS: Record<string, string[]> = {
  invoices: ['storageId', 'receiptStorageId', 'receiptStorageIds[]', 'originalInvoiceStorageIds[]'],
  milestones: ['planStorageId'],
  milestoneEvents: ['planStorageId'],
  resources: ['storageId'],
  resourceSubmissions: ['storageId'],
}

interface FileRef {
  table: string
  rowId: string
  fieldPath: string // exact field path, with `[index]` for array entries
  storageId: Id<'_storage'>
  creationTime: number
}

function extractRefs(table: string, row: Record<string, unknown>): FileRef[] {
  const refs: FileRef[] = []
  for (const fieldPath of FILE_REF_FIELDS[table] ?? []) {
    if (fieldPath.endsWith('[]')) {
      const fieldName = fieldPath.slice(0, -2)
      const arr = row[fieldName]
      if (Array.isArray(arr)) {
        arr.forEach((value, i) => {
          if (typeof value === 'string' && value.length > 0) {
            refs.push({
              table,
              rowId: row._id as string,
              fieldPath: `${fieldName}[${i}]`,
              storageId: value as Id<'_storage'>,
              creationTime: row._creationTime as number,
            })
          }
        })
      }
    } else {
      const value = row[fieldPath]
      if (typeof value === 'string' && value.length > 0) {
        refs.push({
          table,
          rowId: row._id as string,
          fieldPath,
          storageId: value as Id<'_storage'>,
          creationTime: row._creationTime as number,
        })
      }
    }
  }
  return refs
}

/**
 * List the most recent `limit` file references across every table the
 * schema records. Ordered newest-first by the referencing row's
 * `_creationTime`.
 */
export const listRecentFileRefs = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const tables = Object.keys(FILE_REF_FIELDS) as Array<keyof typeof FILE_REF_FIELDS>
    const allRefs: FileRef[] = []
    for (const table of tables) {
      const rows = (await ctx.db.query(table as never).collect()) as Array<Record<string, unknown>>
      for (const row of rows) {
        allRefs.push(...extractRefs(table, row))
      }
    }
    allRefs.sort((a, b) => b.creationTime - a.creationTime)
    return allRefs.slice(0, Math.max(0, args.limit))
  },
})

/** Return a short-lived download URL for a single storage id. */
export const getStorageUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

/**
 * Patch a single dev-side row to point at a freshly uploaded storage id.
 *
 * This is exposed as a regular mutation (not internalMutation) only so the
 * clone script can call it via `ConvexHttpClient` with a deploy key. The
 * script is the only intended caller — calling this against prod by
 * accident would be a genuine mistake, so the clone script's read client
 * never has the schema to call it.
 */
export const rewriteStorageRef = mutation({
  args: {
    table: v.string(),
    rowId: v.string(),
    fieldPath: v.string(), // e.g. "storageId" or "receiptStorageIds[2]"
    newStorageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const allowedFields = FILE_REF_FIELDS[args.table]
    if (!allowedFields) {
      throw new Error(`Table '${args.table}' has no file-ref fields`)
    }

    // Parse optional `[index]` suffix.
    const arrayMatch = args.fieldPath.match(/^([a-zA-Z][a-zA-Z0-9]*)\[(\d+)\]$/)
    const baseField = arrayMatch ? arrayMatch[1] : args.fieldPath
    const arrayIndex = arrayMatch ? parseInt(arrayMatch[2], 10) : null

    const fieldTemplate = arrayMatch ? `${baseField}[]` : baseField
    if (!allowedFields.includes(fieldTemplate)) {
      throw new Error(
        `Field '${args.fieldPath}' is not a registered file-ref field on '${args.table}'`
      )
    }

    const row = (await ctx.db.get(args.rowId as Id<'invoices'>)) as
      | (Record<string, unknown> & { _id: Id<'invoices'> })
      | null
    if (!row) throw new Error(`Row '${args.rowId}' not found in '${args.table}'`)

    const patch: Record<string, unknown> = {}
    if (arrayIndex !== null) {
      const current = row[baseField]
      if (!Array.isArray(current)) {
        throw new Error(`Field '${baseField}' on ${args.table} is not an array`)
      }
      const next = [...current]
      next[arrayIndex] = args.newStorageId
      patch[baseField] = next
    } else {
      patch[baseField] = args.newStorageId
    }

    await ctx.db.patch(row._id, patch as never)
  },
})
