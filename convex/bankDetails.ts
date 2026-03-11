import { query, mutation } from './functions'
import { v } from 'convex/values'
import { requireFounder, requireAdmin } from './auth'

/**
 * Get bank details for the current founder's startup.
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

    return await ctx.db
      .query('bankDetails')
      .withIndex('by_startupId', (q) => q.eq('startupId', founderProfile.startupId))
      .first()
  },
})

/**
 * Get bank details for a startup (admin only).
 */
export const getByStartupId = query({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    return await ctx.db
      .query('bankDetails')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .first()
  },
})

/**
 * Create or update bank details.
 */
export const upsert = mutation({
  args: {
    accountHolderName: v.string(),
    sortCode: v.string(),
    accountNumber: v.string(),
    bankName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)

    const founderProfile = await ctx.db
      .query('founderProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (!founderProfile) throw new Error('Founder profile not found')

    const existing = await ctx.db
      .query('bankDetails')
      .withIndex('by_startupId', (q) => q.eq('startupId', founderProfile.startupId))
      .first()

    const data = {
      accountHolderName: args.accountHolderName,
      sortCode: args.sortCode,
      accountNumber: args.accountNumber,
      bankName: args.bankName,
      verified: false, // Reset on update
    }

    if (existing) {
      await ctx.db.patch(existing._id, data)
      return existing._id
    } else {
      return await ctx.db.insert('bankDetails', {
        startupId: founderProfile.startupId,
        ...data,
      })
    }
  },
})

/**
 * Delete bank details.
 */
export const remove = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)

    const founderProfile = await ctx.db
      .query('founderProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (!founderProfile) throw new Error('Founder profile not found')

    const existing = await ctx.db
      .query('bankDetails')
      .withIndex('by_startupId', (q) => q.eq('startupId', founderProfile.startupId))
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})
