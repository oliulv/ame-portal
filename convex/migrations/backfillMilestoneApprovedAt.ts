import { internalMutation } from '../functions'

/**
 * One-shot migration: populate `milestones.approvedAt` for approved rows.
 *
 * Preferred source is the approval event creation time. Rows that were created
 * already approved and have no event fall back to milestone `_creationTime` and
 * are reported explicitly in the return payload.
 *
 * Run on dev:   npx convex run migrations/backfillMilestoneApprovedAt:run
 * Run on prod:  npx convex run --prod migrations/backfillMilestoneApprovedAt:run
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const milestones = await ctx.db.query('milestones').collect()
    let exactEvent = 0
    let createdApprovedFallback = 0
    let skipped = 0
    const fallbackMilestoneIds: string[] = []

    for (const milestone of milestones) {
      if (milestone.status !== 'approved' || milestone.approvedAt !== undefined) {
        skipped++
        continue
      }

      const events = await ctx.db
        .query('milestoneEvents')
        .withIndex('by_milestoneId', (q) => q.eq('milestoneId', milestone._id))
        .collect()
      const approvedEvent = events
        .filter((event) => event.action === 'approved')
        .sort((a, b) => a._creationTime - b._creationTime)[0]

      if (approvedEvent) {
        await ctx.db.patch(milestone._id, { approvedAt: approvedEvent._creationTime })
        exactEvent++
      } else {
        await ctx.db.patch(milestone._id, { approvedAt: milestone._creationTime })
        createdApprovedFallback++
        fallbackMilestoneIds.push(String(milestone._id))
      }
    }

    console.log(
      `backfillMilestoneApprovedAt: exact=${exactEvent}, fallback=${createdApprovedFallback}, skipped=${skipped}, total=${milestones.length}`
    )
    return {
      exactEvent,
      createdApprovedFallback,
      skipped,
      total: milestones.length,
      fallbackMilestoneIds,
    }
  },
})
