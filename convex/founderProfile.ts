import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requireFounder, requireAuth, requireAdmin } from './auth'

/**
 * Get the current founder's full profile (founder profile + startup + startup profile + bank).
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)

    const founderProfile = await ctx.db
      .query('founderProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (!founderProfile) return null

    const startup = await ctx.db.get(founderProfile.startupId)
    const startupProfile = await ctx.db
      .query('startupProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', founderProfile.startupId))
      .first()
    const bankDetails = await ctx.db
      .query('bankDetails')
      .withIndex('by_startupId', (q) => q.eq('startupId', founderProfile.startupId))
      .first()

    return {
      founderProfile,
      startup,
      startupProfile: startupProfile ?? null,
      bankDetails: bankDetails ?? null,
    }
  },
})

/**
 * Update founder personal information.
 */
export const update = mutation({
  args: {
    fullName: v.optional(v.string()),
    personalEmail: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    postcode: v.optional(v.string()),
    country: v.optional(v.string()),
    phone: v.optional(v.string()),
    bio: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    xUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)

    const founderProfile = await ctx.db
      .query('founderProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (!founderProfile) throw new Error('Founder profile not found')

    // Build patch from non-undefined args
    const patch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) {
        patch[key] = value
      }
    }

    if (Object.keys(patch).length === 0) {
      throw new Error('No fields to update')
    }

    await ctx.db.patch(founderProfile._id, patch)

    // Sync name/email to users table
    const userPatch: Record<string, unknown> = {}
    if (args.fullName !== undefined) userPatch.fullName = args.fullName
    if (args.personalEmail !== undefined) userPatch.email = args.personalEmail

    if (Object.keys(userPatch).length > 0) {
      await ctx.db.patch(user._id, userPatch)
    }
  },
})

/**
 * Get/update admin profile (email, fullName).
 */
export const getAdminProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx)
    return user
  },
})

export const updateAdminProfile = mutation({
  args: {
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      throw new Error('Admin access required')
    }

    const patch: Record<string, unknown> = {}
    if (args.email !== undefined) patch.email = args.email
    if (args.fullName !== undefined) patch.fullName = args.fullName

    if (Object.keys(patch).length === 0) {
      throw new Error('At least one field must be provided')
    }

    await ctx.db.patch(user._id, patch)
  },
})

/**
 * Get a founder profile by user ID (admin only, for invoice uploader info).
 */
export const getByUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    return await ctx.db
      .query('founderProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first()
  },
})
