import { MutationCtx } from '../functions'
import { internalAction } from '../functions'
import { internal } from '../_generated/api'
import { v } from 'convex/values'
import { Id } from '../_generated/dataModel'
import { logConvexError, logConvexInfo } from './logging'

/**
 * Evaluate whether a user should be fully cleaned up after a role removal.
 * Only deletes the user + Clerk account when they have NO remaining associations
 * (no founderProfiles, no adminCohorts, and not a super_admin).
 */
export async function evaluateUserCleanup(ctx: MutationCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId)
  if (!user) return

  // Never auto-delete super admins
  if (user.role === 'super_admin') return

  // Check for remaining founder profiles
  const remainingProfiles = await ctx.db
    .query('founderProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()

  if (remainingProfiles) return

  // Check for remaining admin cohort assignments
  const remainingAdminCohorts = await ctx.db
    .query('adminCohorts')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()

  if (remainingAdminCohorts) return

  // No associations remain — clean up perk claims, user record, and Clerk account
  const perkClaims = await ctx.db
    .query('perkClaims')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()

  for (const claim of perkClaims) {
    await ctx.db.delete(claim._id)
  }

  // Delete the Convex user record first (prevents webhook loop:
  // Clerk deletion triggers webhook → finds no user → no-op)
  const clerkId = user.clerkId
  await ctx.db.delete(userId)

  // Schedule Clerk account deletion
  await ctx.scheduler.runAfter(0, internal.lib.userCleanup.deleteClerkUser, {
    clerkId,
  })
}

/**
 * Internal action to delete a user from Clerk.
 * Handles 404 gracefully (user already deleted).
 */
export const deleteClerkUser = internalAction({
  args: { clerkId: v.string() },
  handler: async (_ctx, args) => {
    const secretKey = process.env.CLERK_SECRET_KEY
    if (!secretKey) {
      logConvexError('CLERK_SECRET_KEY not configured — skipping Clerk user deletion')
      return
    }

    try {
      const response = await fetch(`https://api.clerk.com/v1/users/${args.clerkId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      })

      if (response.ok) {
        logConvexInfo(`Deleted Clerk user ${args.clerkId}`)
      } else if (response.status === 404) {
        logConvexInfo(`Clerk user ${args.clerkId} already deleted`)
      } else {
        const body = await response.text()
        logConvexError(`Failed to delete Clerk user ${args.clerkId}: ${response.status} ${body}`)
      }
    } catch (error) {
      logConvexError(`Error deleting Clerk user ${args.clerkId}:`, error)
    }
  },
})
