import { query, mutation } from './functions'
import { v } from 'convex/values'
import { Doc } from './_generated/dataModel'
import {
  getAdminAccessibleCohortIds,
  requireAdmin,
  requireAdminForCohort,
  requireAdminForStartup,
  requireSuperAdmin,
} from './auth'
import { slugify, generateUniqueSlug } from './lib/slugify'
import { evaluateUserCleanup } from './lib/userCleanup'

/**
 * List startups, optionally filtered by cohort.
 */
export const list = query({
  args: { cohortId: v.optional(v.id('cohorts')) },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx)

    if (args.cohortId) {
      await requireAdminForCohort(ctx, args.cohortId)
      return await ctx.db
        .query('startups')
        .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId!))
        .collect()
    }

    const accessibleCohortIds = await getAdminAccessibleCohortIds(ctx, user)
    const allStartups = await ctx.db.query('startups').collect()
    if (accessibleCohortIds === null) return allStartups

    const allowed = new Set(accessibleCohortIds)
    return allStartups.filter((startup) => allowed.has(startup.cohortId))
  },
})

/**
 * Get a single startup by slug.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const startup = await ctx.db
      .query('startups')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
    if (!startup) return null

    await requireAdminForCohort(ctx, startup.cohortId)
    return startup
  },
})

/**
 * Get a single startup by ID.
 */
export const getById = query({
  args: { id: v.id('startups') },
  handler: async (ctx, args) => {
    const { startup } = await requireAdminForStartup(ctx, args.id)
    return startup
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
    await requireAdminForCohort(ctx, args.cohortId)

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
        status: 'waiting',
        dueDate: template.dueDate,
        sortOrder: i,
        requireLink: template.requireLink,
        requireFile: template.requireFile,
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
    const { id, ...updates } = args
    const current = await ctx.db.get(id)
    if (!current) throw new Error('Startup not found')
    await requireAdminForCohort(ctx, current.cohortId)
    if (updates.cohortId) {
      await requireAdminForCohort(ctx, updates.cohortId)
    }

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
    const user = await requireAdmin(ctx)

    const accessibleCohortIds = await getAdminAccessibleCohortIds(ctx, user)
    const allowedCohortIds = accessibleCohortIds === null ? null : new Set(accessibleCohortIds)

    let allCohorts = await ctx.db.query('cohorts').collect()
    if (allowedCohortIds) {
      allCohorts = allCohorts.filter((cohort) => allowedCohortIds.has(cohort._id))
    }

    let startups: Doc<'startups'>[] = []
    let invoiceCount = 0

    if (args.cohortSlug) {
      const cohort = await ctx.db
        .query('cohorts')
        .withIndex('by_slug', (q) => q.eq('slug', args.cohortSlug!))
        .unique()

      if (cohort) {
        await requireAdminForCohort(ctx, cohort._id)
        startups = await ctx.db
          .query('startups')
          .withIndex('by_cohortId', (q) => q.eq('cohortId', cohort._id))
          .collect()
      } else {
        startups = []
      }
    } else {
      startups = await ctx.db.query('startups').collect()
      if (allowedCohortIds) {
        startups = startups.filter((startup) => allowedCohortIds.has(startup.cohortId))
      }
    }

    const activeStartups = startups.filter((s) => s.excludeFromMetrics !== true)

    // Count only submitted/under_review invoices (pending review) from active startups
    if (args.cohortSlug) {
      for (const s of activeStartups) {
        const invoices = await ctx.db
          .query('invoices')
          .withIndex('by_startupId', (q) => q.eq('startupId', s._id))
          .collect()
        invoiceCount += invoices.filter(
          (i) => i.status === 'submitted' || i.status === 'under_review'
        ).length
      }
    } else {
      const allInvoices = await ctx.db.query('invoices').collect()
      const activeStartupIds = new Set(activeStartups.map((s) => s._id))
      invoiceCount = allInvoices.filter(
        (i) =>
          activeStartupIds.has(i.startupId) &&
          (i.status === 'submitted' || i.status === 'under_review')
      ).length
    }

    return {
      cohortsCount: allCohorts.length,
      startupsCount: activeStartups.length,
      invoicesCount: invoiceCount,
    }
  },
})

/**
 * Permanently delete a startup and all associated data.
 * Requires super_admin role and name confirmation.
 */
export const remove = mutation({
  args: {
    id: v.id('startups'),
    confirmName: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    const startup = await ctx.db.get(args.id)
    if (!startup) throw new Error('Startup not found')

    if (args.confirmName !== startup.name) {
      throw new Error('Confirmation name does not match startup name')
    }

    // 1. Delete tracker events (via tracker websites)
    const trackerWebsites = await ctx.db
      .query('trackerWebsites')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.id))
      .collect()
    for (const website of trackerWebsites) {
      const events = await ctx.db
        .query('trackerEvents')
        .withIndex('by_websiteId', (q) => q.eq('websiteId', website._id))
        .collect()
      for (const event of events) {
        await ctx.db.delete(event._id)
      }
    }

    // 2. Delete tracker websites
    for (const website of trackerWebsites) {
      await ctx.db.delete(website._id)
    }

    // 3. Delete metrics data
    const metricsData = await ctx.db
      .query('metricsData')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.id))
      .collect()
    for (const metric of metricsData) {
      await ctx.db.delete(metric._id)
    }

    // 4. Delete integration connections
    const integrations = await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.id))
      .collect()
    for (const integration of integrations) {
      await ctx.db.delete(integration._id)
    }

    // 5. Delete invoices + stored files
    const invoices = await ctx.db
      .query('invoices')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.id))
      .collect()
    for (const invoice of invoices) {
      if (invoice.storageId) {
        await ctx.storage.delete(invoice.storageId)
      }
      await ctx.db.delete(invoice._id)
    }

    // 6. Delete milestones + plan files
    const milestones = await ctx.db
      .query('milestones')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.id))
      .collect()
    for (const milestone of milestones) {
      if (milestone.planStorageId) {
        await ctx.storage.delete(milestone.planStorageId)
      }
      await ctx.db.delete(milestone._id)
    }

    // 7. Delete perk claims
    const perkClaims = await ctx.db
      .query('perkClaims')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.id))
      .collect()
    for (const claim of perkClaims) {
      await ctx.db.delete(claim._id)
    }

    // 8. Delete bank details
    const bankDetails = await ctx.db
      .query('bankDetails')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.id))
      .collect()
    for (const detail of bankDetails) {
      await ctx.db.delete(detail._id)
    }

    // 9. Delete founder profiles + clean up orphaned founder users
    const founderProfiles = await ctx.db
      .query('founderProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.id))
      .collect()
    const founderUserIds = founderProfiles.map((p) => p.userId)
    for (const profile of founderProfiles) {
      await ctx.db.delete(profile._id)
    }
    // Evaluate each founder for full cleanup (Convex + Clerk deletion)
    for (const userId of founderUserIds) {
      await evaluateUserCleanup(ctx, userId)
    }

    // 10. Delete invitations
    const invitations = await ctx.db
      .query('invitations')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.id))
      .collect()
    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id)
    }

    // 11. Delete startup profiles
    const startupProfiles = await ctx.db
      .query('startupProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.id))
      .collect()
    for (const profile of startupProfiles) {
      await ctx.db.delete(profile._id)
    }

    // 12. Finally delete the startup itself
    await ctx.db.delete(args.id)
  },
})

/**
 * Get startup profile by startup ID (admin).
 */
export const getProfileByStartupId = query({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    await requireAdminForStartup(ctx, args.startupId)
    return await ctx.db
      .query('startupProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .unique()
  },
})

/**
 * Get founder profiles by startup ID (admin).
 */
export const getFounderProfilesByStartupId = query({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    await requireAdminForStartup(ctx, args.startupId)
    return await ctx.db
      .query('founderProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()
  },
})

/**
 * Toggle whether a startup is excluded from cohort aggregate metrics.
 */
export const toggleExcludeFromMetrics = mutation({
  args: {
    id: v.id('startups'),
    exclude: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdminForStartup(ctx, args.id)

    await ctx.db.patch(args.id, { excludeFromMetrics: args.exclude })
  },
})
