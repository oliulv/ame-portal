import { internalMutation } from '../functions'

/**
 * One-shot migration: remove the stale `updateStreak` field from startups docs.
 *
 * The old Tuesday cron (`weeklyUpdates.updateStreaks`) wrote this field weekly.
 * It was removed in the same PR that dropped the runtime dependency — streak
 * is now computed live from `weeklyUpdates` via `convex/lib/streak.ts`. This
 * migration strips the stale cached value so a follow-up PR can remove the
 * field from `convex/schema.ts`.
 *
 * Run on prod:  npx convex run --prod migrations/stripUpdateStreak:run
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const startups = await ctx.db.query('startups').collect()
    let updated = 0

    for (const doc of startups) {
      if ('updateStreak' in (doc as Record<string, unknown>)) {
        await ctx.db.patch(doc._id, { updateStreak: undefined })
        updated++
      }
    }

    console.log(`stripUpdateStreak: stripped ${updated} of ${startups.length} docs`)
    return { updated, total: startups.length }
  },
})
