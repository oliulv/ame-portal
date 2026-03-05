import { query, mutation } from './functions'
import { v } from 'convex/values'
import { requireAdmin, requireAuth, requireFounder, getFounderStartupIds } from './auth'

/**
 * List milestones for a startup (admin).
 */
export const listByStartup = query({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const milestones = await ctx.db
      .query('milestones')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()

    return milestones.sort((a, b) => a.sortOrder - b.sortOrder)
  },
})

/**
 * List milestones for the current founder's startup.
 */
export const listForFounder = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    if (startupIds.length === 0) return []

    const milestones = await ctx.db
      .query('milestones')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupIds[0]))
      .collect()

    return milestones.sort((a, b) => a.sortOrder - b.sortOrder)
  },
})

/**
 * Funding summary for the current founder's startup.
 * Returns unlocked, deployed, and available balance.
 */
export const fundingSummaryForFounder = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    if (startupIds.length === 0) {
      return { unlocked: 0, deployed: 0, available: 0, hasMilestones: false }
    }

    const startupId = startupIds[0]
    const startup = await ctx.db.get(startupId)
    const milestones = await ctx.db
      .query('milestones')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
      .collect()

    const unlocked = milestones
      .filter((m) => m.status === 'approved')
      .reduce((sum, m) => sum + m.amount, 0)
    const deployed = startup?.fundingDeployed ?? 0
    const available = Math.max(0, unlocked - deployed)

    return {
      unlocked,
      deployed,
      available,
      hasMilestones: milestones.length > 0,
    }
  },
})

/**
 * Funding overview for all startups in a cohort (admin).
 */
export const fundingOverview = query({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const cohort = await ctx.db.get(args.cohortId)

    const startups = await ctx.db
      .query('startups')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    let totalPotential = 0
    let totalUnlocked = 0
    let totalDeployed = 0

    const rows = await Promise.all(
      startups.map(async (startup) => {
        const milestones = await ctx.db
          .query('milestones')
          .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
          .collect()

        const potential = milestones.reduce((sum, m) => sum + m.amount, 0)
        const unlocked = milestones
          .filter((m) => m.status === 'approved')
          .reduce((sum, m) => sum + m.amount, 0)
        const deployed = startup.fundingDeployed ?? 0
        const available = Math.max(0, unlocked - deployed)
        const excluded = startup.excludeFromMetrics === true

        if (!excluded) {
          totalPotential += potential
          totalUnlocked += unlocked
          totalDeployed += deployed
        }

        return {
          _id: startup._id,
          name: startup.name,
          slug: startup.slug,
          potential,
          unlocked,
          deployed,
          available,
          milestoneCount: milestones.length,
          excludeFromMetrics: excluded,
        }
      })
    )

    const includedCount = startups.filter((s) => s.excludeFromMetrics !== true).length

    return {
      startups: rows,
      totals: {
        potential: totalPotential,
        unlocked: totalUnlocked,
        deployed: totalDeployed,
        available: Math.max(0, totalUnlocked - totalDeployed),
      },
      cohort: {
        fundingBudget: cohort?.fundingBudget ?? null,
        baseFunding: cohort?.baseFunding ?? null,
        startupCount: includedCount,
      },
    }
  },
})

/**
 * Create a milestone (admin).
 */
export const create = mutation({
  args: {
    startupId: v.id('startups'),
    title: v.string(),
    description: v.string(),
    amount: v.number(),
    status: v.optional(
      v.union(v.literal('waiting'), v.literal('submitted'), v.literal('approved'))
    ),
    dueDate: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    let sortOrder = args.sortOrder
    if (sortOrder === undefined) {
      const existing = await ctx.db
        .query('milestones')
        .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
        .collect()
      sortOrder = existing.length
    }

    return await ctx.db.insert('milestones', {
      startupId: args.startupId,
      title: args.title,
      description: args.description,
      amount: args.amount,
      status: args.status ?? 'waiting',
      dueDate: args.dueDate,
      sortOrder,
    })
  },
})

/**
 * Update a milestone (admin).
 */
export const update = mutation({
  args: {
    id: v.id('milestones'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    amount: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal('waiting'), v.literal('submitted'), v.literal('approved'))
    ),
    dueDate: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const { id, ...updates } = args
    const milestone = await ctx.db.get(id)
    if (!milestone) throw new Error('Milestone not found')

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
 * Delete a milestone (admin).
 */
export const remove = mutation({
  args: { id: v.id('milestones') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const milestone = await ctx.db.get(args.id)
    if (!milestone) throw new Error('Milestone not found')

    await ctx.db.delete(args.id)
  },
})

/**
 * Approve a submitted milestone (admin). Changes submitted → approved.
 */
export const approve = mutation({
  args: { id: v.id('milestones') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const milestone = await ctx.db.get(args.id)
    if (!milestone) throw new Error('Milestone not found')
    if (milestone.status !== 'submitted') {
      throw new Error('Only submitted milestones can be approved')
    }

    await ctx.db.patch(args.id, { status: 'approved' })
  },
})

/**
 * Submit a milestone (founder). Changes waiting → submitted.
 * Requires at least a plan link or uploaded plan file as evidence.
 */
export const submit = mutation({
  args: {
    id: v.id('milestones'),
    planLink: v.optional(v.string()),
    planStorageId: v.optional(v.id('_storage')),
    planFileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    const milestone = await ctx.db.get(args.id)
    if (!milestone) throw new Error('Milestone not found')
    if (!startupIds.includes(milestone.startupId)) {
      throw new Error('Not authorized')
    }
    if (milestone.status !== 'waiting') {
      throw new Error('Only waiting milestones can be submitted')
    }

    if (!args.planLink && !args.planStorageId) {
      throw new Error('Please provide a plan link or upload a plan file')
    }

    await ctx.db.patch(args.id, {
      status: 'submitted',
      planLink: args.planLink,
      planStorageId: args.planStorageId,
      planFileName: args.planFileName,
    })
  },
})

/**
 * Withdraw a submitted milestone (founder). Changes submitted → waiting.
 * Clears the attached evidence so the founder can re-submit with updated files.
 */
export const withdraw = mutation({
  args: { id: v.id('milestones') },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    const milestone = await ctx.db.get(args.id)
    if (!milestone) throw new Error('Milestone not found')
    if (!startupIds.includes(milestone.startupId)) {
      throw new Error('Not authorized')
    }
    if (milestone.status !== 'submitted') {
      throw new Error('Only submitted milestones can be withdrawn')
    }

    await ctx.db.patch(args.id, {
      status: 'waiting',
      planLink: undefined,
      planStorageId: undefined,
      planFileName: undefined,
    })
  },
})

/**
 * Reorder milestones (admin).
 */
export const reorder = mutation({
  args: { milestoneIds: v.array(v.id('milestones')) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    for (let i = 0; i < args.milestoneIds.length; i++) {
      await ctx.db.patch(args.milestoneIds[i], { sortOrder: i })
    }
  },
})

/**
 * Generate a pre-signed upload URL for milestone plan files.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Get a URL for a stored milestone plan file.
 */
export const getFileUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

/**
 * Update the funding deployed amount for a startup (admin).
 */
export const updateFundingDeployed = mutation({
  args: {
    startupId: v.id('startups'),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const startup = await ctx.db.get(args.startupId)
    if (!startup) throw new Error('Startup not found')

    await ctx.db.patch(args.startupId, { fundingDeployed: args.amount })
  },
})
