import { internalMutation } from '../functions'
import { v } from 'convex/values'

function guardProd() {
  if (process.env.APP_URL === 'https://www.ameportal.com') {
    throw new Error('SAFETY: Cannot run sync mutations in production!')
  }
}

/**
 * Upsert a batch of records into a table.
 *
 * For the `users` table: deduplicates by `clerkId` (skips if exists).
 * For all other tables: deduplicates by `syncSourceId`:
 *   - Previously synced records (syncSource === "prod") are updated.
 *   - Dev-only records are never touched.
 *   - New records are inserted with syncSource/syncSourceId tags.
 *
 * Returns a map of syncSourceId -> new dev _id for each record.
 */
export const upsertBatch = internalMutation({
  args: {
    table: v.string(),
    records: v.array(v.any()),
  },
  handler: async (ctx, { table, records }) => {
    guardProd()

    const idMap: Record<string, string> = {}
    const counts = { inserted: 0, updated: 0, skipped: 0 }

    const db = ctx.db as any

    if (table === 'users') {
      for (const record of records) {
        const { syncSourceId, ...data } = record
        const existing = await ctx.db
          .query('users')
          .withIndex('by_clerkId', (q) => q.eq('clerkId', data.clerkId))
          .unique()

        if (existing) {
          idMap[syncSourceId] = existing._id
          counts.skipped++
        } else {
          const newId = await ctx.db.insert('users', {
            ...data,
            syncSource: 'prod',
            syncSourceId,
          })
          idMap[syncSourceId] = newId
          counts.inserted++
        }
      }
      return { idMap, counts }
    }

    // For all other tables: collect existing synced records to build lookup
    const allDocs = await db.query(table).collect()
    const existingBySyncId = new Map<string, { _id: string; syncSource?: string }>()
    for (const doc of allDocs) {
      if (doc.syncSourceId) {
        existingBySyncId.set(doc.syncSourceId, doc)
      }
    }

    for (const record of records) {
      const { syncSourceId, ...data } = record
      const existing = existingBySyncId.get(syncSourceId)

      if (existing) {
        if (existing.syncSource === 'prod') {
          // Update previously synced record with latest prod data
          await db.patch(existing._id, { ...data, syncSource: 'prod', syncSourceId })
          idMap[syncSourceId] = existing._id
          counts.updated++
        } else {
          // Dev-only record, don't touch
          idMap[syncSourceId] = existing._id
          counts.skipped++
        }
      } else {
        const newId = await db.insert(table, {
          ...data,
          syncSource: 'prod',
          syncSourceId,
        })
        idMap[syncSourceId] = newId
        counts.inserted++
      }
    }

    return { idMap, counts }
  },
})
