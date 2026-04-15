/**
 * Helpers used by `scripts/clone-prod-to-dev.ts` to selectively copy the
 * most recent file-storage blobs from prod to dev without paying the full
 * cost of `convex export --include-file-storage`.
 *
 * Every export here is `internalQuery` / `internalMutation`, not public.
 * The clone script calls them via `npx convex run` with a deploy key,
 * matching the `dev/swapClerkIds:run` subprocess pattern already used by
 * the same script. There is NO public surface for listing storage ids,
 * fetching storage URLs, or rewriting storage refs.
 */

import { internalQuery, internalMutation } from './functions'
import { v } from 'convex/values'
import type { Id, TableNames } from './_generated/dataModel'

// Every table → list of field paths that hold `_storage` ids. Nested array
// fields use the `[]` suffix so the helper knows to iterate. Keep in sync
// with `convex/schema.ts` — `fileClone.test.ts` asserts this map covers
// every `v.id('_storage')` reference in the schema.
const FILE_REF_FIELDS = {
  invoices: ['storageId', 'receiptStorageId', 'receiptStorageIds[]', 'originalInvoiceStorageIds[]'],
  milestones: ['planStorageId'],
  milestoneEvents: ['planStorageId'],
  resources: ['storageId'],
  resourceSubmissions: ['storageId'],
} as const satisfies Record<string, readonly string[]>

type FileRefTable = keyof typeof FILE_REF_FIELDS

export const FILE_REF_TABLES = Object.keys(FILE_REF_FIELDS) as FileRefTable[]
export { FILE_REF_FIELDS }

const MAX_REF_LIMIT = 500

interface FileRef {
  table: FileRefTable
  rowId: string
  fieldPath: string
  storageId: Id<'_storage'>
  creationTime: number
}

function extractRefs(table: FileRefTable, row: Record<string, unknown>): FileRef[] {
  const refs: FileRef[] = []
  for (const fieldPath of FILE_REF_FIELDS[table]) {
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
 * List the most recent `limit` file references across every table that
 * has `_storage` refs, ordered newest-first by the referencing row's
 * `_creationTime`. Bounded to at most `limit * 2` rows per table so a
 * bloated table can't OOM the query.
 */
export const listRecentFileRefs = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(0, Math.floor(args.limit)), MAX_REF_LIMIT)
    if (limit === 0) return []

    // Convex orders newest-first via the default _creationTime index.
    // Take a small multiple to cover rows with multiple storage fields.
    const perTableTake = Math.min(limit * 2, MAX_REF_LIMIT)

    const allRefs: FileRef[] = []
    for (const table of FILE_REF_TABLES) {
      const rows = (await ctx.db.query(table).order('desc').take(perTableTake)) as Array<
        Record<string, unknown>
      >
      for (const row of rows) {
        allRefs.push(...extractRefs(table, row))
      }
    }
    allRefs.sort((a, b) => b.creationTime - a.creationTime)
    return allRefs.slice(0, limit)
  },
})

/** Return a short-lived download URL for a single storage id. */
export const getStorageUrl = internalQuery({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

/**
 * Generate a pre-signed upload URL for the clone script to PUT bytes into
 * the dev deployment's file storage. Replaces the undocumented
 * `/api/storage/upload` endpoint the script used to call.
 */
export const generateUploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Patch a single dev-side row to point at a freshly uploaded storage id.
 *
 * Validates that `rowId` actually belongs to `table` via `ctx.db.normalizeId`
 * so an attacker (or a buggy caller) can't use a field-name collision
 * (`storageId` exists on several tables) to overwrite the wrong row.
 */
export const rewriteStorageRef = internalMutation({
  args: {
    table: v.string(),
    rowId: v.string(),
    fieldPath: v.string(), // e.g. "storageId" or "receiptStorageIds[2]"
    newStorageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    if (!(args.table in FILE_REF_FIELDS)) {
      throw new Error(`Table '${args.table}' has no file-ref fields`)
    }
    const table = args.table as FileRefTable
    const allowedFields = FILE_REF_FIELDS[table]

    // Parse optional `[index]` suffix.
    const arrayMatch = args.fieldPath.match(/^([a-zA-Z][a-zA-Z0-9]*)\[(\d+)\]$/)
    const baseField = arrayMatch ? arrayMatch[1] : args.fieldPath
    const arrayIndex = arrayMatch ? parseInt(arrayMatch[2], 10) : null

    const fieldTemplate = arrayMatch ? `${baseField}[]` : baseField
    if (!(allowedFields as readonly string[]).includes(fieldTemplate)) {
      throw new Error(
        `Field '${args.fieldPath}' is not a registered file-ref field on '${args.table}'`
      )
    }

    // Validate the rowId actually belongs to the claimed table. Defends
    // against field-name collisions (e.g. `storageId` on both `invoices`
    // and `resources`) that would otherwise let a caller cross-write.
    const normalizedId = ctx.db.normalizeId(table as TableNames, args.rowId)
    if (!normalizedId) {
      throw new Error(`Row id '${args.rowId}' does not belong to table '${args.table}'`)
    }

    const row = (await ctx.db.get(normalizedId)) as
      | (Record<string, unknown> & { _id: Id<TableNames> })
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
