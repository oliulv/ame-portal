import { query, mutation, internalMutation } from './functions'
import { v } from 'convex/values'
import { getCurrentUser, requireAuth } from './auth'
import { cascadeDeleteUserData } from './lib/userCleanup'
import { internal } from './_generated/api'

/**
 * Get the current authenticated user.
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx)
  },
})

/**
 * Create or update a user record from Clerk webhook / first login.
 */
export const upsertFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
    role: v.optional(v.union(v.literal('super_admin'), v.literal('admin'), v.literal('founder'))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.email !== undefined && { email: args.email }),
        ...(args.fullName !== undefined && { fullName: args.fullName }),
      })
      return existing._id
    }

    return await ctx.db.insert('users', {
      clerkId: args.clerkId,
      role: args.role ?? 'founder',
      email: args.email,
      fullName: args.fullName,
    })
  },
})

/**
 * Create a user (used by invitation acceptance flow).
 */
export const create = mutation({
  args: {
    clerkId: v.string(),
    role: v.union(v.literal('super_admin'), v.literal('admin'), v.literal('founder')),
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique()

    if (existing) return existing._id

    return await ctx.db.insert('users', {
      clerkId: args.clerkId,
      role: args.role,
      email: args.email,
      fullName: args.fullName,
    })
  },
})

/**
 * Ensure the current authenticated user has a record in the users table.
 * Called on app load — if the user exists in Clerk but not in Convex,
 * checks for a matching pending invitation and auto-accepts it.
 * This is a safety net for cases where the invite page accept flow
 * doesn't fire (e.g. redirect issues after Clerk sign-up).
 */
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
      .unique()

    if (existing) {
      // Sync email, name, and profile picture from Clerk on every login so Convex
      // always reflects the canonical Clerk profile data.
      const updates: Partial<{ email: string; fullName: string; imageUrl: string }> = {}
      if (identity.email && identity.email !== existing.email) {
        updates.email = identity.email
      }
      if (identity.name && identity.name !== existing.fullName) {
        updates.fullName = identity.name
      }
      if (identity.pictureUrl && identity.pictureUrl !== existing.imageUrl) {
        updates.imageUrl = identity.pictureUrl
      }
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates)
      }

      // If founder-role user has no founderProfile (stale state after startup deletion),
      // check for pending invitations and auto-accept to restore their association.
      if (existing.role === 'founder' && identity.email) {
        const hasProfile = await ctx.db
          .query('founderProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', existing._id))
          .first()

        if (!hasProfile) {
          const now = new Date()
          const allInvitations = await ctx.db.query('invitations').collect()
          const pendingInvite = allInvitations.find(
            (inv) =>
              inv.email.toLowerCase() === identity.email!.toLowerCase() &&
              !inv.acceptedAt &&
              new Date(inv.expiresAt) > now
          )

          if (pendingInvite) {
            await ctx.db.insert('founderProfiles', {
              userId: existing._id,
              startupId: pendingInvite.startupId,
              fullName: pendingInvite.fullName,
              personalEmail: pendingInvite.email,
              onboardingStatus: 'pending',
            })
            await ctx.db.patch(pendingInvite._id, {
              acceptedAt: new Date().toISOString(),
            })
          }
        }
      }

      return existing._id
    }

    // User exists in Clerk but not in Convex. Check for a matching
    // pending invitation by email and auto-accept it as a fallback.
    const email = identity.email
    if (!email) return null

    const now = new Date()

    // Check founder invitations
    const founderInvitations = await ctx.db.query('invitations').collect()
    const founderInvite = founderInvitations.find(
      (inv) =>
        inv.email.toLowerCase() === email.toLowerCase() &&
        !inv.acceptedAt &&
        new Date(inv.expiresAt) > now
    )

    if (founderInvite) {
      const userId = await ctx.db.insert('users', {
        clerkId: identity.subject,
        role: 'founder',
        email,
        fullName: identity.name ?? founderInvite.fullName,
      })

      const existingProfile = await ctx.db
        .query('founderProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .filter((q) => q.eq(q.field('startupId'), founderInvite.startupId))
        .first()

      if (!existingProfile) {
        await ctx.db.insert('founderProfiles', {
          userId,
          startupId: founderInvite.startupId,
          fullName: founderInvite.fullName,
          personalEmail: founderInvite.email,
          onboardingStatus: 'pending',
        })
      }

      await ctx.db.patch(founderInvite._id, {
        acceptedAt: new Date().toISOString(),
      })

      return userId
    }

    // Check admin invitations
    const adminInvitations = await ctx.db.query('adminInvitations').collect()
    const adminInvite = adminInvitations.find(
      (inv) =>
        inv.email.toLowerCase() === email.toLowerCase() &&
        !inv.acceptedAt &&
        new Date(inv.expiresAt) > now
    )

    if (adminInvite) {
      const userId = await ctx.db.insert('users', {
        clerkId: identity.subject,
        role: adminInvite.role,
        email,
        fullName: identity.name ?? adminInvite.invitedName,
      })

      if (adminInvite.cohortId) {
        await ctx.db.insert('adminCohorts', {
          userId,
          cohortId: adminInvite.cohortId,
        })
      }

      await ctx.db.patch(adminInvite._id, {
        acceptedAt: new Date().toISOString(),
      })

      return userId
    }

    return null
  },
})

/**
 * Delete a user and all associated data (admin only).
 * Cascade-deletes founderProfiles, invitations, adminCohorts,
 * perkClaims, eventRegistrations, and the user record.
 */
export const remove = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const admin = await requireAuth(ctx)
    if (admin.role !== 'super_admin') {
      throw new Error('Super admin access required')
    }

    const user = await ctx.db.get(args.userId)
    if (!user) throw new Error('User not found')

    const clerkId = user.clerkId
    await cascadeDeleteUserData(ctx, args.userId)

    // Schedule Clerk account deletion
    await ctx.scheduler.runAfter(0, internal.lib.userCleanup.deleteClerkUser, {
      clerkId,
    })
  },
})

/**
 * One-time cleanup mutation for orphaned data.
 * Internal-only — run from the Convex dashboard.
 * Finds and deletes records that reference non-existent users.
 */
export const cleanupOrphanedData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const summary = {
      founderProfiles: 0,
      invitations: 0,
      adminCohorts: 0,
      perkClaims: 0,
      eventRegistrations: 0,
      integrationConnections: 0,
    }

    // 1. founderProfiles where userId → non-existent user
    const allProfiles = await ctx.db.query('founderProfiles').collect()
    const orphanedProfilesByStartup = new Map<string, Set<string>>()

    for (const profile of allProfiles) {
      const user = await ctx.db.get(profile.userId)
      if (!user) {
        // Track startupId + email (lowercased) for case-insensitive invitation cleanup
        if (!orphanedProfilesByStartup.has(profile.startupId)) {
          orphanedProfilesByStartup.set(profile.startupId, new Set())
        }
        orphanedProfilesByStartup.get(profile.startupId)!.add(profile.personalEmail.toLowerCase())
        await ctx.db.delete(profile._id)
        summary.founderProfiles++
      }
    }

    // 2. invitations with acceptedAt where no matching founderProfile exists
    //    (also clean up invitations matching orphaned profiles we just deleted).
    //    All email comparisons are case-insensitive — exact match misses case-drifted rows.
    const allInvitations = await ctx.db.query('invitations').collect()
    for (const invitation of allInvitations) {
      const inviteEmailLower = invitation.email.toLowerCase()

      // Case A: accepted invitation but no matching founderProfile (case-insensitive)
      if (invitation.acceptedAt) {
        const startupProfiles = await ctx.db
          .query('founderProfiles')
          .withIndex('by_startupId', (q) => q.eq('startupId', invitation.startupId))
          .collect()

        const matchingProfile = startupProfiles.find(
          (p) => p.personalEmail.toLowerCase() === inviteEmailLower
        )

        if (!matchingProfile) {
          await ctx.db.delete(invitation._id)
          summary.invitations++
          continue
        }
      }

      // Case B: invitation matches a profile we just deleted as orphaned
      const orphanedEmails = orphanedProfilesByStartup.get(invitation.startupId)
      if (orphanedEmails?.has(inviteEmailLower)) {
        await ctx.db.delete(invitation._id)
        summary.invitations++
      }
    }

    // 6. integrationConnections where connectedByUserId → non-existent user.
    //    Detach (null out + disconnect) so the next founder can reconnect cleanly.
    //    Don't delete — the row may hold financial/audit history (Stripe, GitHub).
    const allConnections = await ctx.db.query('integrationConnections').collect()
    for (const conn of allConnections) {
      if (!conn.connectedByUserId) continue
      const user = await ctx.db.get(conn.connectedByUserId)
      if (!user) {
        await ctx.db.patch(conn._id, {
          connectedByUserId: undefined,
          isActive: false,
          status: 'disconnected',
          accessToken: undefined,
          refreshToken: undefined,
          tokenExpiresAt: undefined,
        })
        summary.integrationConnections++
      }
    }

    // 3. adminCohorts where userId → non-existent user
    const allAdminCohorts = await ctx.db.query('adminCohorts').collect()
    for (const ac of allAdminCohorts) {
      const user = await ctx.db.get(ac.userId)
      if (!user) {
        await ctx.db.delete(ac._id)
        summary.adminCohorts++
      }
    }

    // 4. perkClaims where userId → non-existent user
    const allPerkClaims = await ctx.db.query('perkClaims').collect()
    for (const claim of allPerkClaims) {
      const user = await ctx.db.get(claim.userId)
      if (!user) {
        await ctx.db.delete(claim._id)
        summary.perkClaims++
      }
    }

    // 5. eventRegistrations where userId → non-existent user
    const allRegistrations = await ctx.db.query('eventRegistrations').collect()
    for (const reg of allRegistrations) {
      const user = await ctx.db.get(reg.userId)
      if (!user) {
        await ctx.db.delete(reg._id)
        summary.eventRegistrations++
      }
    }

    return summary
  },
})
