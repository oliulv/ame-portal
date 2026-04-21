import { internalMutation } from '../functions'
import { classifyMilestoneForBackfill } from './classifyMilestoneForBackfill'

/**
 * One-shot migration: populate `milestones.approvedAt` for every milestone
 * that is currently `status === 'approved'` and has at least one
 * `milestoneEvents.action === 'approved'` row.
 *
 * The leaderboard's milestones category now gates on "approved within the
 * last 28 days" via `approvedAt`, so rows without the denormalized
 * timestamp effectively drop out of scoring until re-approved. This
 * backfill catches every pre-existing approved row in one pass; the new
 * `approve` mutation handles it going forward.
 *
 * Skip policy:
 *   skipped_notApproved — status !== 'approved'
 *   skipped_alreadySet  — approvedAt already populated (idempotent re-run)
 *   skipped_noEvent     — status === 'approved' but no 'approved' event in
 *                         milestoneEvents (seed data, manual DB edits, or
 *                         pre-events-era rows). IDs logged so admin can
 *                         manually triage (re-approve via UI or patch).
 *
 * Invariant: patched + skipped_notApproved + skipped_alreadySet + skipped_noEvent === total
 *
 * Run on dev:   npx convex run migrations/backfillMilestoneApprovedAt:run
 * Run on prod:  npx convex run --prod migrations/backfillMilestoneApprovedAt:run
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const milestones = await ctx.db.query('milestones').collect()
    let patched = 0
    let skippedNotApproved = 0
    let skippedAlreadySet = 0
    let skippedNoEvent = 0
    const skippedNoEventIds: string[] = []

    for (const milestone of milestones) {
      const events = await ctx.db
        .query('milestoneEvents')
        .withIndex('by_milestoneId', (q) => q.eq('milestoneId', milestone._id))
        .collect()

      const classification = classifyMilestoneForBackfill(milestone, events)
      switch (classification.kind) {
        case 'patch':
          await ctx.db.patch(milestone._id, { approvedAt: classification.approvedAt })
          patched++
          break
        case 'skip-not-approved':
          skippedNotApproved++
          break
        case 'skip-already-set':
          skippedAlreadySet++
          break
        case 'skip-no-event':
          skippedNoEvent++
          skippedNoEventIds.push(milestone._id)
          break
      }
    }

    if (skippedNoEventIds.length > 0) {
      console.log(
        `backfillMilestoneApprovedAt: ${skippedNoEventIds.length} approved milestones with no approval event — manually triage these IDs:`,
        skippedNoEventIds
      )
    }

    console.log(
      `backfillMilestoneApprovedAt: patched ${patched}, skipped_notApproved ${skippedNotApproved}, skipped_alreadySet ${skippedAlreadySet}, skipped_noEvent ${skippedNoEvent} of ${milestones.length}`
    )

    return {
      patched,
      skippedNotApproved,
      skippedAlreadySet,
      skippedNoEvent,
      skippedNoEventIds,
      total: milestones.length,
    }
  },
})
