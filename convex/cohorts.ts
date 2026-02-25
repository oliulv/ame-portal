import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requireAdmin, requireSuperAdmin } from './auth'
import { slugify, generateUniqueSlug } from './lib/slugify'

/**
 * List cohorts visible to the current admin.
 * Super admins see all, regular admins only see assigned cohorts.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx)

    if (user.role === 'super_admin') {
      return await ctx.db.query('cohorts').collect()
    }

    // Regular admin: fetch assigned cohorts
    const assignments = await ctx.db
      .query('adminCohorts')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect()

    const cohorts = await Promise.all(assignments.map((a) => ctx.db.get(a.cohortId)))

    return cohorts
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.yearStart - a.yearStart)
  },
})

/**
 * Get a single cohort by slug.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    return await ctx.db
      .query('cohorts')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
  },
})

/**
 * Create a new cohort (super admin only).
 */
export const create = mutation({
  args: {
    name: v.string(),
    label: v.string(),
    yearStart: v.number(),
    yearEnd: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    // Generate unique slug
    const allCohorts = await ctx.db.query('cohorts').collect()
    const existingSlugs = allCohorts.map((c) => c.slug)
    const slug = generateUniqueSlug(slugify(args.label), existingSlugs)

    // Create cohort
    const cohortId = await ctx.db.insert('cohorts', {
      name: args.name,
      label: args.label,
      slug,
      yearStart: args.yearStart,
      yearEnd: args.yearEnd,
      isActive: args.isActive,
    })

    return cohortId
  },
})

/**
 * Update a cohort (super admin only).
 */
export const update = mutation({
  args: {
    id: v.id('cohorts'),
    name: v.string(),
    label: v.string(),
    yearStart: v.number(),
    yearEnd: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    const current = await ctx.db.get(args.id)
    if (!current) throw new Error('Cohort not found')

    // Regenerate slug if label changed
    let slug = current.slug
    if (args.label !== current.label) {
      const allCohorts = await ctx.db.query('cohorts').collect()
      const existingSlugs = allCohorts.filter((c) => c._id !== args.id).map((c) => c.slug)
      slug = generateUniqueSlug(slugify(args.label), existingSlugs)
    }

    await ctx.db.patch(args.id, {
      name: args.name,
      label: args.label,
      slug,
      yearStart: args.yearStart,
      yearEnd: args.yearEnd,
      isActive: args.isActive,
    })

    return { slug }
  },
})

/**
 * Delete a cohort (super admin only).
 */
export const remove = mutation({
  args: { id: v.id('cohorts') },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)
    await ctx.db.delete(args.id)
  },
})
