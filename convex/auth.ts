import { QueryCtx, MutationCtx } from './functions'
import { Doc } from './_generated/dataModel'

export type UserRole = 'super_admin' | 'admin' | 'founder'

/**
 * Get the current authenticated user from the Clerk JWT identity
 * and look up their record in the users table.
 */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  // identity.subject is the Clerk userId
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerkId', (q) => q.eq('clerkId', identity.subject))
    .unique()

  return user
}

/**
 * Get the current user or throw — used in mutations/queries that require auth.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<Doc<'users'>> {
  const user = await getCurrentUser(ctx)
  if (!user) {
    throw new Error('Not authenticated')
  }
  return user
}

/**
 * Require the user to be an admin (admin or super_admin).
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<'users'>> {
  const user = await requireAuth(ctx)
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    throw new Error('Admin access required')
  }
  return user
}

/**
 * Require the user to be a super admin.
 */
export async function requireSuperAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<'users'>> {
  const user = await requireAuth(ctx)
  if (user.role !== 'super_admin') {
    throw new Error('Super admin access required')
  }
  return user
}

/**
 * Require the user to be a founder, or an admin/super_admin with a founderProfile.
 */
export async function requireFounder(ctx: QueryCtx | MutationCtx): Promise<Doc<'users'>> {
  const user = await requireAuth(ctx)

  // All roles must have a founderProfile to access founder endpoints
  if (user.role === 'founder' || user.role === 'admin' || user.role === 'super_admin') {
    const profile = await ctx.db
      .query('founderProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()
    if (profile) return user
  }

  throw new Error('Founder access required')
}

/**
 * Check if a user has a specific delegated permission for a cohort.
 */
export async function hasPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Doc<'users'>['_id'],
  cohortId: Doc<'cohorts'>['_id'],
  permission: 'approve_milestones' | 'approve_invoices' | 'send_announcements'
): Promise<boolean> {
  const row = await ctx.db
    .query('adminPermissions')
    .withIndex('by_userId_cohortId_permission', (q) =>
      q.eq('userId', userId).eq('cohortId', cohortId).eq('permission', permission)
    )
    .first()
  return !!row
}

/**
 * Require the user to be a super_admin OR have a specific delegated permission.
 */
export async function requireAdminWithPermission(
  ctx: QueryCtx | MutationCtx,
  cohortId: Doc<'cohorts'>['_id'],
  permission: 'approve_milestones' | 'approve_invoices' | 'send_announcements'
): Promise<Doc<'users'>> {
  const user = await requireAdmin(ctx)
  if (user.role === 'super_admin') return user
  const has = await hasPermission(ctx, user._id, cohortId, permission)
  if (!has) {
    throw new Error(`Permission required: ${permission}`)
  }
  return user
}

/**
 * Get the startup IDs associated with a founder user.
 */
export async function getFounderStartupIds(
  ctx: QueryCtx | MutationCtx,
  userId: Doc<'users'>['_id']
): Promise<Doc<'startups'>['_id'][]> {
  const profiles = await ctx.db
    .query('founderProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect()

  return profiles.map((p) => p.startupId)
}
