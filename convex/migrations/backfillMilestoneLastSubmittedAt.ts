import { internalMutation } from '../functions'

/**
 * One-shot migration: populate `milestones.lastSubmittedAt` for every
 * milestone that has at least one submit event.
 *
 * Before this PR, the admin inbox read `_creationTime` (when the
 * milestone row was first created, usually when the template was
 * assigned) and called it "Submitted X". The real submission time lives
 * in `milestoneEvents` rows with `action === 'submitted'`. The submit
 * mutation now denormalizes the latest submit time onto the milestone
 * row so reads are a single field lookup, but existing rows predate
 * that change and have no `lastSubmittedAt`.
 *
 * This backfill walks every milestone, finds the latest submit event
 * for it, and patches `lastSubmittedAt` accordingly. After it runs,
 * `listSubmittedByCohort` never hits the per-row fallback query.
 *
 * Run on dev:   npx convex run migrations/backfillMilestoneLastSubmittedAt:run
 * Run on prod:  npx convex run --prod migrations/backfillMilestoneLastSubmittedAt:run
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const milestones = await ctx.db.query('milestones').collect()
    let patched = 0
    let skipped = 0

    for (const milestone of milestones) {
      if (milestone.lastSubmittedAt !== undefined) {
        skipped++
        continue
      }

      const events = await ctx.db
        .query('milestoneEvents')
        .withIndex('by_milestoneId', (q) => q.eq('milestoneId', milestone._id))
        .collect()
      const latestSubmit = events
        .filter((e) => e.action === 'submitted')
        .sort((a, b) => b._creationTime - a._creationTime)[0]

      if (!latestSubmit) {
        skipped++
        continue
      }

      await ctx.db.patch(milestone._id, { lastSubmittedAt: latestSubmit._creationTime })
      patched++
    }

    console.log(
      `backfillMilestoneLastSubmittedAt: patched ${patched}, skipped ${skipped} of ${milestones.length}`
    )
    return { patched, skipped, total: milestones.length }
  },
})
