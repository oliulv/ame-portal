import { query, mutation } from './functions'
import { v } from 'convex/values'
import { requireAdmin, requireSuperAdmin, hasPermission } from './auth'

const permissionValue = v.union(v.literal('approve_milestones'), v.literal('approve_invoices'))

/**
 * Check if the current user has a specific permission for a cohort.
 * Super admins always return true.
 */
export const checkMyPermission = query({
  args: {
    cohortId: v.id('cohorts'),
    permission: permissionValue,
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx)
    if (user.role === 'super_admin') return true
    return hasPermission(ctx, user._id, args.cohortId, args.permission)
  },
})

/**
 * List all delegated permissions for a cohort.
 */
export const list = query({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)
    const all = await ctx.db.query('adminPermissions').collect()
    return all.filter((p) => p.cohortId === args.cohortId)
  },
})

/**
 * Grant a permission to a user for a cohort.
 */
export const grant = mutation({
  args: {
    userId: v.id('users'),
    cohortId: v.id('cohorts'),
    permission: permissionValue,
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    // Check for duplicate
    const existing = await ctx.db
      .query('adminPermissions')
      .withIndex('by_userId_cohortId_permission', (q) =>
        q.eq('userId', args.userId).eq('cohortId', args.cohortId).eq('permission', args.permission)
      )
      .first()

    if (existing) return existing._id

    return await ctx.db.insert('adminPermissions', {
      userId: args.userId,
      cohortId: args.cohortId,
      permission: args.permission,
    })
  },
})

/**
 * Revoke a permission from a user for a cohort.
 */
export const revoke = mutation({
  args: {
    userId: v.id('users'),
    cohortId: v.id('cohorts'),
    permission: permissionValue,
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    const existing = await ctx.db
      .query('adminPermissions')
      .withIndex('by_userId_cohortId_permission', (q) =>
        q.eq('userId', args.userId).eq('cohortId', args.cohortId).eq('permission', args.permission)
      )
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})
