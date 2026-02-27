import { query, mutation, internalMutation } from './functions'
import { v } from 'convex/values'
import { getCurrentUser, requireAuth } from './auth'

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
 * Called on app load — if the user exists in Clerk but not in Convex
 * (e.g. first login after invitation), this creates their record.
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
      // Sync email and name from Clerk on every login so Convex
      // always reflects the canonical Clerk profile data.
      const updates: Partial<{ email: string; fullName: string }> = {}
      if (identity.email && identity.email !== existing.email) {
        updates.email = identity.email
      }
      if (identity.name && identity.name !== existing.fullName) {
        updates.fullName = identity.name
      }
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates)
      }
      return existing._id
    }

    // Don't auto-provision unknown users with elevated roles.
    // User records are created through invitation acceptance flows
    // (founder via invitations.accept, admin via adminInvitations.accept).
    return null
  },
})

/**
 * Delete a user (admin only).
 */
export const remove = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const admin = await requireAuth(ctx)
    if (admin.role !== 'super_admin') {
      throw new Error('Super admin access required')
    }
    await ctx.db.delete(args.userId)
  },
})
