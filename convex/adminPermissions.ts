import { query, mutation } from './functions'
import { v } from 'convex/values'
import { requireAdmin, requireSuperAdmin, hasPermission, adminCanAccessCohort } from './auth'

const permissionValue = v.union(
  v.literal('approve_milestones'),
  v.literal('approve_invoices'),
  v.literal('send_announcements'),
  v.literal('manage_notifications')
)

/**
 * Check if the current user has a specific permission for a cohort.
 * Super admins always return true.
 *
 * Pass `startupId` for startup-scoped operations (milestones, invoices).
 * Without it, only cohort-wide grants are considered.
 */
export const checkMyPermission = query({
  args: {
    cohortId: v.id('cohorts'),
    permission: permissionValue,
    startupId: v.optional(v.id('startups')),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx)
    if (user.role === 'super_admin') return true
    const allowed = await adminCanAccessCohort(ctx, user, args.cohortId)
    if (!allowed) return false
    return hasPermission(ctx, user._id, args.cohortId, args.permission, args.startupId)
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
 *
 * Omit `startupId` to grant cohort-wide (applies to every startup). When
 * granting cohort-wide we also delete any pre-existing startup-scoped
 * rows for the same (user, cohort, permission) so the super-admin can
 * later revoke the cohort-wide grant without silently re-enabling
 * old narrow grants they may have forgotten about.
 *
 * Provide `startupId` to restrict the grant to a single startup.
 */
export const grant = mutation({
  args: {
    userId: v.id('users'),
    cohortId: v.id('cohorts'),
    permission: permissionValue,
    startupId: v.optional(v.id('startups')),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    const existing = await ctx.db
      .query('adminPermissions')
      .withIndex('by_userId_cohortId_permission', (q) =>
        q.eq('userId', args.userId).eq('cohortId', args.cohortId).eq('permission', args.permission)
      )
      .collect()

    const duplicate = existing.find((row) => (row.startupId ?? null) === (args.startupId ?? null))
    if (duplicate) return duplicate._id

    // Cohort-wide grant supersedes any narrower startup-scoped rows.
    if (args.startupId === undefined) {
      for (const row of existing) {
        if (row.startupId != null) {
          await ctx.db.delete(row._id)
        }
      }
    }

    return await ctx.db.insert('adminPermissions', {
      userId: args.userId,
      cohortId: args.cohortId,
      permission: args.permission,
      ...(args.startupId ? { startupId: args.startupId } : {}),
    })
  },
})

/**
 * Revoke a permission from a user for a cohort.
 *
 * Matches on the same (userId, cohortId, permission, startupId?) tuple used
 * to grant. Omit `startupId` to revoke a cohort-wide grant.
 */
export const revoke = mutation({
  args: {
    userId: v.id('users'),
    cohortId: v.id('cohorts'),
    permission: permissionValue,
    startupId: v.optional(v.id('startups')),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    const rows = await ctx.db
      .query('adminPermissions')
      .withIndex('by_userId_cohortId_permission', (q) =>
        q.eq('userId', args.userId).eq('cohortId', args.cohortId).eq('permission', args.permission)
      )
      .collect()

    const target = rows.find((row) => (row.startupId ?? null) === (args.startupId ?? null))
    if (target) {
      await ctx.db.delete(target._id)
    }
  },
})
