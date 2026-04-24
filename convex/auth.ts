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
 * Check whether an admin user may access a cohort.
 * Super admins see every cohort; regular admins only see assigned cohorts.
 */
export async function adminCanAccessCohort(
  ctx: QueryCtx | MutationCtx,
  user: Doc<'users'>,
  cohortId: Doc<'cohorts'>['_id']
): Promise<boolean> {
  if (user.role === 'super_admin') return true
  if (user.role !== 'admin') return false

  const assignment = await ctx.db
    .query('adminCohorts')
    .withIndex('by_userId_cohortId', (q) => q.eq('userId', user._id).eq('cohortId', cohortId))
    .unique()

  return assignment !== null
}

/**
 * Require an admin to have access to a specific cohort.
 */
export async function requireAdminForCohort(
  ctx: QueryCtx | MutationCtx,
  cohortId: Doc<'cohorts'>['_id']
): Promise<Doc<'users'>> {
  const user = await requireAdmin(ctx)
  const allowed = await adminCanAccessCohort(ctx, user, cohortId)
  if (!allowed) {
    throw new Error('Not authorized for this cohort')
  }
  return user
}

/**
 * List cohort IDs visible to an admin user.
 */
export async function getAdminAccessibleCohortIds(
  ctx: QueryCtx | MutationCtx,
  user: Doc<'users'>
): Promise<Doc<'cohorts'>['_id'][] | null> {
  if (user.role === 'super_admin') return null
  if (user.role !== 'admin') return []

  const assignments = await ctx.db
    .query('adminCohorts')
    .withIndex('by_userId', (q) => q.eq('userId', user._id))
    .collect()

  return assignments.map((a) => a.cohortId)
}

/**
 * Require an admin to have access to a startup's cohort and return the startup.
 */
export async function requireAdminForStartup(
  ctx: QueryCtx | MutationCtx,
  startupId: Doc<'startups'>['_id']
): Promise<{ user: Doc<'users'>; startup: Doc<'startups'> }> {
  const startup = await ctx.db.get(startupId)
  if (!startup) throw new Error('Startup not found')
  const user = await requireAdminForCohort(ctx, startup.cohortId)
  return { user, startup }
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

type DelegatedPermission =
  | 'approve_milestones'
  | 'approve_invoices'
  | 'send_announcements'
  | 'manage_notifications'

/**
 * Pure decision function for whether a set of stored adminPermissions rows
 * grants access to a target operation. Extracted for unit testing.
 *
 * A cohort-wide row (startupId == null) always grants access. A startup-scoped
 * row only grants when `startupId` is provided and matches exactly.
 */
export function permissionRowsGrantAccess(
  rows: Array<{ startupId?: Doc<'startups'>['_id'] }>,
  startupId?: Doc<'startups'>['_id']
): boolean {
  if (rows.length === 0) return false
  for (const row of rows) {
    if (row.startupId == null) return true
    if (startupId && row.startupId === startupId) return true
  }
  return false
}

// startupId semantics on hasPermission / requireAdminWithPermission:
//   omitted  → only cohort-wide grants count; startup-scoped grants are ignored
//   provided → cohort-wide grants OR a grant that exactly matches startupId both pass
//
// Always pass startupId when the operation is startup-scoped. Omitting it when you
// have one is a bug: it would deny legitimate startup-scoped grants (safe), but
// passing the wrong startupId would deny a legitimate cohort-wide grant on a row
// that happens to have no startupId — which is why we check "row.startupId == null"
// first.
export async function hasPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Doc<'users'>['_id'],
  cohortId: Doc<'cohorts'>['_id'],
  permission: DelegatedPermission,
  startupId?: Doc<'startups'>['_id']
): Promise<boolean> {
  const rows = await ctx.db
    .query('adminPermissions')
    .withIndex('by_userId_cohortId_permission', (q) =>
      q.eq('userId', userId).eq('cohortId', cohortId).eq('permission', permission)
    )
    .collect()
  return permissionRowsGrantAccess(rows, startupId)
}

/**
 * Require the user to be a super_admin OR have a specific delegated permission.
 * Pass startupId for startup-scoped operations (milestone / invoice approval).
 */
export async function requireAdminWithPermission(
  ctx: QueryCtx | MutationCtx,
  cohortId: Doc<'cohorts'>['_id'],
  permission: DelegatedPermission,
  startupId?: Doc<'startups'>['_id']
): Promise<Doc<'users'>> {
  const user = await requireAdmin(ctx)
  if (user.role === 'super_admin') return user
  const allowed = await adminCanAccessCohort(ctx, user, cohortId)
  if (!allowed) {
    throw new Error('Not authorized for this cohort')
  }
  const has = await hasPermission(ctx, user._id, cohortId, permission, startupId)
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

/**
 * Require the current user to have access to a specific startup.
 * Super admins have access to all startups. Regular admins only have access
 * to startups in assigned cohorts. Founders only have access to startups
 * linked via their founderProfiles.
 */
export async function requireStartupAccess(
  ctx: QueryCtx | MutationCtx,
  startupId: Doc<'startups'>['_id']
): Promise<Doc<'users'>> {
  const user = await requireAuth(ctx)

  const startup = await ctx.db.get(startupId)
  if (!startup) {
    throw new Error('Startup not found')
  }

  if (user.role === 'super_admin') {
    return user
  }

  if (user.role === 'admin') {
    const allowed = await adminCanAccessCohort(ctx, user, startup.cohortId)
    if (allowed) return user

    // Admins can also use founder-facing flows for startups where they have
    // an explicit founderProfile.
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.includes(startupId)) return user

    throw new Error('Not authorized for this startup')
  }

  // Founders must own the startup
  const startupIds = await getFounderStartupIds(ctx, user._id)
  if (!startupIds.includes(startupId)) {
    throw new Error('Not authorized for this startup')
  }

  return user
}
