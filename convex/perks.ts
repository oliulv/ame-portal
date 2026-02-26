import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requireAdmin, requireAuth, requireFounder, getFounderStartupIds } from './auth'

/**
 * List perks for a cohort with claim counts (admin).
 */
export const list = query({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const perks = await ctx.db
      .query('perks')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const sorted = perks.sort((a, b) => a.sortOrder - b.sortOrder)

    const perksWithCounts = await Promise.all(
      sorted.map(async (perk) => {
        const claims = await ctx.db
          .query('perkClaims')
          .withIndex('by_perkId', (q) => q.eq('perkId', perk._id))
          .collect()
        return { ...perk, claimCount: claims.length }
      })
    )

    return perksWithCounts
  },
})

/**
 * Get a single perk with its claims joined with user/startup info (admin).
 */
export const getById = query({
  args: { id: v.id('perks') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const perk = await ctx.db.get(args.id)
    if (!perk) throw new Error('Perk not found')

    const claims = await ctx.db
      .query('perkClaims')
      .withIndex('by_perkId', (q) => q.eq('perkId', perk._id))
      .collect()

    const claimsWithDetails = await Promise.all(
      claims.map(async (claim) => {
        const user = await ctx.db.get(claim.userId)
        const startup = await ctx.db.get(claim.startupId)
        return {
          ...claim,
          userName: user?.fullName ?? 'Unknown',
          startupName: startup?.name ?? 'Unknown',
        }
      })
    )

    return { ...perk, claims: claimsWithDetails }
  },
})

/**
 * List active perks for the current founder's cohort with claim status.
 */
export const listForFounder = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx)

    // Find founder profile — works for founders and admins with a founderProfile
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) return []

    const startup = await ctx.db.get(startupIds[0])
    if (!startup) return []

    const perks = await ctx.db
      .query('perks')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', startup.cohortId))
      .collect()

    const activePerks = perks
      .filter((p) => p.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    const perksWithClaimStatus = await Promise.all(
      activePerks.map(async (perk) => {
        const claim = await ctx.db
          .query('perkClaims')
          .withIndex('by_perkId_userId', (q) =>
            q.eq('perkId', perk._id).eq('userId', user._id)
          )
          .first()
        return {
          ...perk,
          isClaimed: !!claim,
          claimedAt: claim?.claimedAt,
        }
      })
    )

    return perksWithClaimStatus
  },
})

/**
 * Create a perk (admin).
 */
export const create = mutation({
  args: {
    cohortId: v.id('cohorts'),
    title: v.string(),
    description: v.string(),
    details: v.optional(v.string()),
    category: v.optional(v.string()),
    providerName: v.optional(v.string()),
    providerLogoUrl: v.optional(v.string()),
    url: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const existing = await ctx.db
      .query('perks')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const sortOrder = existing.length

    return await ctx.db.insert('perks', {
      cohortId: args.cohortId,
      title: args.title,
      description: args.description,
      details: args.details,
      category: args.category,
      providerName: args.providerName,
      providerLogoUrl: args.providerLogoUrl,
      url: args.url,
      isActive: args.isActive ?? true,
      sortOrder,
    })
  },
})

/**
 * Update a perk (admin).
 */
export const update = mutation({
  args: {
    id: v.id('perks'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    details: v.optional(v.string()),
    category: v.optional(v.string()),
    providerName: v.optional(v.string()),
    providerLogoUrl: v.optional(v.string()),
    url: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const { id, ...updates } = args
    const perk = await ctx.db.get(id)
    if (!perk) throw new Error('Perk not found')

    const patch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value
      }
    }

    await ctx.db.patch(id, patch)
  },
})

/**
 * Delete a perk and cascade-delete all its claims (admin).
 */
export const remove = mutation({
  args: { id: v.id('perks') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const perk = await ctx.db.get(args.id)
    if (!perk) throw new Error('Perk not found')

    // Cascade-delete all claims for this perk
    const claims = await ctx.db
      .query('perkClaims')
      .withIndex('by_perkId', (q) => q.eq('perkId', args.id))
      .collect()

    for (const claim of claims) {
      await ctx.db.delete(claim._id)
    }

    await ctx.db.delete(args.id)
  },
})

/**
 * Claim a perk (founder).
 */
export const claim = mutation({
  args: { perkId: v.id('perks') },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    if (startupIds.length === 0) throw new Error('No startup found')

    const startup = await ctx.db.get(startupIds[0])
    if (!startup) throw new Error('Startup not found')

    const perk = await ctx.db.get(args.perkId)
    if (!perk) throw new Error('Perk not found')
    if (!perk.isActive) throw new Error('Perk is not active')
    if (perk.cohortId !== startup.cohortId) throw new Error('Perk not in your cohort')

    // Check not already claimed
    const existing = await ctx.db
      .query('perkClaims')
      .withIndex('by_perkId_userId', (q) =>
        q.eq('perkId', args.perkId).eq('userId', user._id)
      )
      .first()

    if (existing) throw new Error('Already claimed')

    await ctx.db.insert('perkClaims', {
      perkId: args.perkId,
      userId: user._id,
      startupId: startup._id,
      claimedAt: new Date().toISOString(),
    })
  },
})

/**
 * Unclaim a perk (founder).
 */
export const unclaim = mutation({
  args: { perkId: v.id('perks') },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    const claim = await ctx.db
      .query('perkClaims')
      .withIndex('by_perkId_userId', (q) =>
        q.eq('perkId', args.perkId).eq('userId', user._id)
      )
      .first()

    if (!claim) throw new Error('Claim not found')

    await ctx.db.delete(claim._id)
  },
})
