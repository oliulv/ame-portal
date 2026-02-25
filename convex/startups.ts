import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requireAdmin } from './auth'
import { slugify, generateUniqueSlug } from './lib/slugify'

/**
 * List startups, optionally filtered by cohort.
 */
export const list = query({
  args: { cohortId: v.optional(v.id('cohorts')) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    if (args.cohortId) {
      return await ctx.db
        .query('startups')
        .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId!))
        .collect()
    }

    return await ctx.db.query('startups').collect()
  },
})

/**
 * Get a single startup by slug.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    return await ctx.db
      .query('startups')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
  },
})

/**
 * Get a single startup by ID.
 */
export const getById = query({
  args: { id: v.id('startups') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return await ctx.db.get(args.id)
  },
})

/**
 * Create a startup with cascade: startup_profiles, bank_details, and goals from templates.
 */
export const create = mutation({
  args: {
    cohortId: v.id('cohorts'),
    name: v.string(),
    logoUrl: v.optional(v.string()),
    sector: v.optional(v.string()),
    stage: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Generate unique slug
    const allStartups = await ctx.db.query('startups').collect()
    const existingSlugs = allStartups.map((s) => s.slug).filter((s): s is string => !!s)
    const slug = generateUniqueSlug(slugify(args.name), existingSlugs)

    // Create startup
    const startupId = await ctx.db.insert('startups', {
      cohortId: args.cohortId,
      name: args.name,
      slug,
      logoUrl: args.logoUrl,
      sector: args.sector,
      stage: args.stage,
      websiteUrl: args.websiteUrl,
      notes: args.notes,
      onboardingStatus: 'pending',
    })

    // Create empty startup profile
    await ctx.db.insert('startupProfiles', {
      startupId,
    })

    // Create default "Submit Plan" milestone (£750, auto-approved)
    await ctx.db.insert('milestones', {
      startupId,
      title: 'Submit Plan',
      description: 'Submit your startup plan to unlock initial funding.',
      amount: 750,
      status: 'approved',
      sortOrder: 0,
    })

    // Create milestones from active milestone templates for this cohort
    const templates = await ctx.db
      .query('milestoneTemplates')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const activeTemplates = templates
      .filter((t) => t.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    for (let i = 0; i < activeTemplates.length; i++) {
      const template = activeTemplates[i]
      await ctx.db.insert('milestones', {
        startupId,
        milestoneTemplateId: template._id,
        title: template.title,
        description: template.description,
        amount: template.amount,
        status: 'active',
        dueDate: template.dueDate,
        sortOrder: i + 1, // +1 because "Submit Plan" is at 0
      })
    }

    return startupId
  },
})

/**
 * Update a startup.
 */
export const update = mutation({
  args: {
    id: v.id('startups'),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    cohortId: v.optional(v.id('cohorts')),
    logoUrl: v.optional(v.string()),
    sector: v.optional(v.string()),
    stage: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    onboardingStatus: v.optional(
      v.union(v.literal('pending'), v.literal('in_progress'), v.literal('completed'))
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const { id, ...updates } = args
    const current = await ctx.db.get(id)
    if (!current) throw new Error('Startup not found')

    // If slug is being changed, validate uniqueness
    if (updates.slug && updates.slug !== current.slug) {
      const existing = await ctx.db
        .query('startups')
        .withIndex('by_slug', (q) => q.eq('slug', updates.slug!))
        .unique()
      if (existing) {
        throw new Error('A startup with this slug already exists')
      }
    }

    // Filter out undefined values
    const patch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value
      }
    }

    await ctx.db.patch(id, patch)
    return { slug: updates.slug ?? current.slug }
  },
})

/**
 * Dashboard stats: counts for cohorts, startups, invoices.
 */
export const dashboardStats = query({
  args: { cohortSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const allCohorts = await ctx.db.query('cohorts').collect()

    let startups
    let invoiceCount = 0

    if (args.cohortSlug) {
      const cohort = await ctx.db
        .query('cohorts')
        .withIndex('by_slug', (q) => q.eq('slug', args.cohortSlug!))
        .unique()

      if (cohort) {
        startups = await ctx.db
          .query('startups')
          .withIndex('by_cohortId', (q) => q.eq('cohortId', cohort._id))
          .collect()

        // Count invoices for these startups
        for (const s of startups) {
          const invoices = await ctx.db
            .query('invoices')
            .withIndex('by_startupId', (q) => q.eq('startupId', s._id))
            .collect()
          invoiceCount += invoices.length
        }
      } else {
        startups = []
      }
    } else {
      startups = await ctx.db.query('startups').collect()
      const allInvoices = await ctx.db.query('invoices').collect()
      invoiceCount = allInvoices.length
    }

    return {
      cohortsCount: allCohorts.length,
      startupsCount: startups.length,
      invoicesCount: invoiceCount,
    }
  },
})
