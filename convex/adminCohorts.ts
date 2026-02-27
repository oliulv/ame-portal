import { query, mutation } from './functions'
import { v } from 'convex/values'
import { requireSuperAdmin } from './auth'
import { evaluateUserCleanup } from './lib/userCleanup'

/**
 * Assign an admin to a cohort.
 */
export const assign = mutation({
  args: {
    userId: v.id('users'),
    cohortId: v.id('cohorts'),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    // Verify user is an admin
    const user = await ctx.db.get(args.userId)
    if (!user) throw new Error('User not found')
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      throw new Error('User is not an admin')
    }

    // Verify cohort exists
    const cohort = await ctx.db.get(args.cohortId)
    if (!cohort) throw new Error('Cohort not found')

    // Check if already assigned
    const existing = await ctx.db
      .query('adminCohorts')
      .withIndex('by_userId_cohortId', (q) =>
        q.eq('userId', args.userId).eq('cohortId', args.cohortId)
      )
      .unique()

    if (existing) throw new Error('Admin is already assigned to this cohort')

    return await ctx.db.insert('adminCohorts', {
      userId: args.userId,
      cohortId: args.cohortId,
    })
  },
})

/**
 * Remove an admin from a cohort. Evaluates whether the user should be
 * fully cleaned up (Convex + Clerk) if they have no remaining associations.
 */
export const remove = mutation({
  args: {
    userId: v.id('users'),
    cohortId: v.id('cohorts'),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    const assignment = await ctx.db
      .query('adminCohorts')
      .withIndex('by_userId_cohortId', (q) =>
        q.eq('userId', args.userId).eq('cohortId', args.cohortId)
      )
      .unique()

    if (!assignment) throw new Error('Assignment not found')

    await ctx.db.delete(assignment._id)

    // Evaluate full cleanup now that this assignment is removed
    await evaluateUserCleanup(ctx, args.userId)
  },
})

/**
 * List cohort assignments for a user.
 */
export const listByUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    return await ctx.db
      .query('adminCohorts')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .collect()
  },
})
