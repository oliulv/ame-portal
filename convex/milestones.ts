import { query, mutation } from './functions'
import { v } from 'convex/values'
import {
  requireAdmin,
  requireAdminWithPermission,
  requireAuth,
  requireFounder,
  getFounderStartupIds,
} from './auth'

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
 * Get a single milestone by ID for the current founder.
 */
export const getForFounder = query({
  args: { id: v.id('milestones') },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    const milestone = await ctx.db.get(args.id)
    if (!milestone) return null
    if (!startupIds.includes(milestone.startupId)) return null

    return milestone
  },
})

/**
 * List audit trail events for a milestone, enriched with user info.
 */
export const listEvents = query({
  args: { milestoneId: v.id('milestones') },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const events = await ctx.db
      .query('milestoneEvents')
      .withIndex('by_milestoneId', (q) => q.eq('milestoneId', args.milestoneId))
      .collect()

    const enriched = await Promise.all(
      events.map(async (event) => {
        const user = await ctx.db.get(event.userId)
        let fileUrl: string | null = null
        if (event.planStorageId) {
          fileUrl = await ctx.storage.getUrl(event.planStorageId)
        }
        return {
          ...event,
          userName: user?.fullName ?? user?.email ?? 'Unknown',
          userRole: user?.role,
          fileUrl,
        }
      })
    )

    return enriched.sort((a, b) => a._creationTime - b._creationTime)
  },
})

/**
 * Get a single milestone by ID (admin).
 */
export const getForAdmin = query({
  args: { id: v.id('milestones') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const milestone = await ctx.db.get(args.id)
    if (!milestone) return null

    const startup = await ctx.db.get(milestone.startupId)
    return {
      ...milestone,
      startupName: startup?.name,
      startupSlug: startup?.slug,
      cohortId: startup?.cohortId,
    }
  },
})

/**
 * List all submitted milestones across a cohort (admin inbox).
 */
export const listSubmittedByCohort = query({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const startups = await ctx.db
      .query('startups')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const results = []
    for (const startup of startups) {
      const milestones = await ctx.db
        .query('milestones')
        .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
        .collect()

      for (const m of milestones) {
        if (m.status === 'submitted') {
          results.push({
            ...m,
            startupName: startup.name,
            startupSlug: startup.slug,
          })
        }
      }
    }

    // Sort by creation time, newest first
    return results.sort((a, b) => b._creationTime - a._creationTime)
  },
})

/**
 * Funding summary for the current founder's startup.
 * Returns unlocked, deployed, and available balance.
 * Deployed is computed from the sum of all paid invoices.
 */
export const fundingSummaryForFounder = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    if (startupIds.length === 0) {
      return {
        unlocked: 0,
        deployed: 0,
        available: 0,
        potential: 0,
        baseline: 0,
        hasMilestones: false,
      }
    }

    const startupId = startupIds[0]
    const startup = await ctx.db.get(startupId)
    const cohort = startup ? await ctx.db.get(startup.cohortId) : null

    const milestones = await ctx.db
      .query('milestones')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
      .collect()

    const potential = milestones.reduce((sum, m) => sum + m.amount, 0)
    const unlocked = milestones
      .filter((m) => m.status === 'approved')
      .reduce((sum, m) => sum + m.amount, 0)

    const paidInvoices = await ctx.db
      .query('invoices')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
      .collect()
    const deployed = paidInvoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + i.amountGbp, 0)

    const available = Math.max(0, unlocked - deployed)

    return {
      unlocked,
      deployed,
      available,
      potential,
      baseline: cohort?.baseFunding ?? 0,
      hasMilestones: milestones.length > 0,
    }
  },
})

/**
 * Funding summary for a specific startup (admin).
 */
export const fundingSummaryForAdmin = query({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const startup = await ctx.db.get(args.startupId)
    const cohort = startup ? await ctx.db.get(startup.cohortId) : null

    const milestones = await ctx.db
      .query('milestones')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()

    const potential = milestones.reduce((sum, m) => sum + m.amount, 0)
    const unlocked = milestones
      .filter((m) => m.status === 'approved')
      .reduce((sum, m) => sum + m.amount, 0)

    const invoices = await ctx.db
      .query('invoices')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()
    const deployed = invoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + i.amountGbp, 0)

    const available = Math.max(0, unlocked - deployed)

    return {
      unlocked,
      deployed,
      available,
      potential,
      baseline: cohort?.baseFunding ?? 0,
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

        const paidInvoices = await ctx.db
          .query('invoices')
          .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
          .collect()
        const deployed = paidInvoices
          .filter((i) => i.status === 'paid')
          .reduce((sum, i) => sum + i.amountGbp, 0)

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
      v.union(
        v.literal('waiting'),
        v.literal('submitted'),
        v.literal('approved'),
        v.literal('changes_requested')
      )
    ),
    dueDate: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    requireLink: v.optional(v.boolean()),
    requireFile: v.optional(v.boolean()),
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
      requireLink: args.requireLink,
      requireFile: args.requireFile,
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
      v.union(
        v.literal('waiting'),
        v.literal('submitted'),
        v.literal('approved'),
        v.literal('changes_requested')
      )
    ),
    dueDate: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    requireLink: v.optional(v.boolean()),
    requireFile: v.optional(v.boolean()),
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
    const milestone = await ctx.db.get(args.id)
    if (!milestone) throw new Error('Milestone not found')
    if (milestone.status !== 'submitted') {
      throw new Error('Only submitted milestones can be approved')
    }

    const startup = await ctx.db.get(milestone.startupId)
    if (!startup) throw new Error('Startup not found')
    const admin = await requireAdminWithPermission(ctx, startup.cohortId, 'approve_milestones')

    await ctx.db.patch(args.id, { status: 'approved' })

    await ctx.db.insert('milestoneEvents', {
      milestoneId: args.id,
      action: 'approved',
      userId: admin._id,
    })
  },
})

/**
 * Request changes on a submitted milestone (admin).
 * Sets submitted -> changes_requested with optional comment.
 */
export const requestChanges = mutation({
  args: {
    id: v.id('milestones'),
    adminComment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const milestone = await ctx.db.get(args.id)
    if (!milestone) throw new Error('Milestone not found')
    if (milestone.status !== 'submitted') {
      throw new Error('Only submitted milestones can have changes requested')
    }

    const startup = await ctx.db.get(milestone.startupId)
    if (!startup) throw new Error('Startup not found')
    const admin = await requireAdminWithPermission(ctx, startup.cohortId, 'approve_milestones')

    const comment = args.adminComment?.trim() || undefined

    await ctx.db.patch(args.id, {
      status: 'changes_requested',
      adminComment: comment,
    })

    await ctx.db.insert('milestoneEvents', {
      milestoneId: args.id,
      action: 'changes_requested',
      userId: admin._id,
      comment,
      // Snapshot the evidence that was reviewed
      planLink: milestone.planLink,
      planStorageId: milestone.planStorageId,
      planFileName: milestone.planFileName,
    })
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
    if (milestone.status !== 'waiting' && milestone.status !== 'changes_requested') {
      throw new Error('Only waiting or changes-requested milestones can be submitted')
    }

    const needsLink = milestone.requireLink !== false
    const needsFile = milestone.requireFile !== false

    if (needsLink && needsFile) {
      if (!args.planLink && !args.planStorageId) {
        throw new Error('Please provide a plan link or upload a plan file')
      }
    } else if (needsLink && !needsFile) {
      if (!args.planLink) {
        throw new Error('Please provide a plan link')
      }
    } else if (!needsLink && needsFile) {
      if (!args.planStorageId) {
        throw new Error('Please upload a plan file')
      }
    } else {
      // Both false — still require at least one
      if (!args.planLink && !args.planStorageId) {
        throw new Error('Please provide a plan link or upload a plan file')
      }
    }

    await ctx.db.patch(args.id, {
      status: 'submitted',
      planLink: args.planLink,
      planStorageId: args.planStorageId,
      planFileName: args.planFileName,
    })

    await ctx.db.insert('milestoneEvents', {
      milestoneId: args.id,
      action: 'submitted',
      userId: user._id,
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

    // Snapshot the evidence before clearing it
    await ctx.db.insert('milestoneEvents', {
      milestoneId: args.id,
      action: 'withdrawn',
      userId: user._id,
      planLink: milestone.planLink,
      planStorageId: milestone.planStorageId,
      planFileName: milestone.planFileName,
    })

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
