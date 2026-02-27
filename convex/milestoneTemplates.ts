import { query, mutation } from './functions'
import { v } from 'convex/values'
import { requireAdmin } from './auth'

/**
 * List milestone templates for a cohort (admin).
 */
export const list = query({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const templates = await ctx.db
      .query('milestoneTemplates')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    return templates.sort((a, b) => a.sortOrder - b.sortOrder)
  },
})

/**
 * Create a milestone template (admin).
 * If isActive, auto-creates milestones for all existing startups in the cohort.
 */
export const create = mutation({
  args: {
    cohortId: v.id('cohorts'),
    title: v.string(),
    description: v.string(),
    amount: v.number(),
    dueDate: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const existing = await ctx.db
      .query('milestoneTemplates')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const sortOrder = existing.length
    const isActive = args.isActive ?? true

    const templateId = await ctx.db.insert('milestoneTemplates', {
      cohortId: args.cohortId,
      title: args.title,
      description: args.description,
      amount: args.amount,
      dueDate: args.dueDate,
      sortOrder,
      isActive,
    })

    // If active, auto-create milestones for all existing startups in the cohort
    if (isActive) {
      const startups = await ctx.db
        .query('startups')
        .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
        .collect()

      for (const startup of startups) {
        // Get current milestone count for sortOrder
        const milestones = await ctx.db
          .query('milestones')
          .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
          .collect()

        await ctx.db.insert('milestones', {
          startupId: startup._id,
          milestoneTemplateId: templateId,
          title: args.title,
          description: args.description,
          amount: args.amount,
          status: 'waiting',
          dueDate: args.dueDate,
          sortOrder: milestones.length,
        })
      }
    }

    return templateId
  },
})

/**
 * Update a milestone template (admin).
 */
export const update = mutation({
  args: {
    id: v.id('milestoneTemplates'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    amount: v.optional(v.number()),
    dueDate: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const { id, ...updates } = args
    const template = await ctx.db.get(id)
    if (!template) throw new Error('Milestone template not found')

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
 * Delete a milestone template (admin).
 */
export const remove = mutation({
  args: { id: v.id('milestoneTemplates') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const template = await ctx.db.get(args.id)
    if (!template) throw new Error('Milestone template not found')

    await ctx.db.delete(args.id)
  },
})

/**
 * Reorder milestone templates (admin).
 */
export const reorder = mutation({
  args: { templateIds: v.array(v.id('milestoneTemplates')) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    for (let i = 0; i < args.templateIds.length; i++) {
      await ctx.db.patch(args.templateIds[i], { sortOrder: i })
    }
  },
})
