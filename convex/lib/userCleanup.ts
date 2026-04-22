import { MutationCtx } from '../functions'
import { internalAction } from '../functions'
import { internal } from '../_generated/api'
import { v } from 'convex/values'
import { Id } from '../_generated/dataModel'
import { logConvexError, logConvexInfo } from './logging'

/**
 * Cascade-delete all data associated with a user.
 * Cleans up: founderProfiles (+ matching invitations), adminCohorts,
 * perkClaims, eventRegistrations, and the user record itself.
 * Also detaches the user from integrationConnections they authored so the
 * next founder can reconnect — the row itself survives for audit/financial history.
 *
 * Skips audit/financial references (invoices, adminInvitations.createdByUserId,
 * invitations.createdByAdminId).
 */
export async function cascadeDeleteUserData(ctx: MutationCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId)
  const userEmail = user?.email?.toLowerCase() ?? null

  // Delete founderProfiles and their matching invitations
  const founderProfiles = await ctx.db
    .query('founderProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()

  // Capture startupIds before deleting profiles so we can scope the integrationConnections
  // scan below to just the startups this user was involved with.
  const startupIds = founderProfiles.map((p) => p.startupId)

  for (const profile of founderProfiles) {
    // Find and delete any invitation on this startup whose email matches the
    // profile's personalEmail OR the user's current email (case-insensitive).
    // This survives (a) founders updating personalEmail post-accept and (b) case drift.
    const allStartupInvites = await ctx.db
      .query('invitations')
      .withIndex('by_startupId', (q) => q.eq('startupId', profile.startupId))
      .collect()

    const targetEmails = new Set(
      [profile.personalEmail, userEmail].filter((e): e is string => !!e).map((e) => e.toLowerCase())
    )

    for (const invitation of allStartupInvites) {
      if (targetEmails.has(invitation.email.toLowerCase())) {
        await ctx.db.delete(invitation._id)
      }
    }

    await ctx.db.delete(profile._id)
  }

  // Detach user from any integrationConnections they authored. We keep the row
  // (financial/audit history + the startup may still be actively syncing) but null
  // out connectedByUserId and disconnect it so the next founder can re-auth cleanly.
  // Without this, integrations.ts:201 blocks the new founder with "already connected
  // by another team member" because it compares against a now-deleted user ID.
  // Scoped to startups this user was a founder of — avoids a full-table scan.
  for (const startupId of startupIds) {
    const startupConnections = await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
      .collect()

    for (const conn of startupConnections) {
      if (conn.connectedByUserId === userId) {
        await ctx.db.patch(conn._id, {
          connectedByUserId: undefined,
          isActive: false,
          status: 'disconnected',
          accessToken: undefined,
          refreshToken: undefined,
          tokenExpiresAt: undefined,
        })
      }
    }
  }

  // Delete admin cohort assignments
  const adminCohorts = await ctx.db
    .query('adminCohorts')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()

  for (const assignment of adminCohorts) {
    await ctx.db.delete(assignment._id)
  }

  // Delete perk claims
  const perkClaims = await ctx.db
    .query('perkClaims')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()

  for (const claim of perkClaims) {
    await ctx.db.delete(claim._id)
  }

  // Delete event registrations
  const eventRegistrations = await ctx.db
    .query('eventRegistrations')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()

  for (const registration of eventRegistrations) {
    await ctx.db.delete(registration._id)
  }

  // Delete the user record
  await ctx.db.delete(userId)
}

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

  // No associations remain — cascade-delete everything and schedule Clerk cleanup
  const clerkId = user.clerkId
  await cascadeDeleteUserData(ctx, userId)

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
