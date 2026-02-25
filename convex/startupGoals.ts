import {
  query,
  mutation,
  internalAction,
  internalQuery,
  internalMutation,
} from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireAdmin, requireFounder, requireAuth, getFounderStartupIds } from './auth'

/**
 * List goals for a specific startup (admin view).
 */
export const listByStartup = query({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const goals = await ctx.db
      .query('startupGoals')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()

    // Enrich with template sort order
    const enriched = await Promise.all(
      goals.map(async (goal) => {
        let sortOrder: number | null = null
        if (goal.goalTemplateId) {
          const template = await ctx.db.get(goal.goalTemplateId)
          sortOrder = template?.sortOrder ?? null
        }
        return { ...goal, templateSortOrder: sortOrder }
      })
    )

    // Sort by template sort order, then creation time
    enriched.sort((a, b) => {
      if (a.templateSortOrder !== null && b.templateSortOrder !== null) {
        return a.templateSortOrder - b.templateSortOrder
      }
      if (a.templateSortOrder !== null) return -1
      if (b.templateSortOrder !== null) return 1
      return a._creationTime - b._creationTime
    })

    return enriched
  },
})

/**
 * List goals for the current founder's startup(s).
 * Prepends a "Join AccelerateMe" goal as always-completed first item.
 */
export const listForFounder = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    if (startupIds.length === 0) return []

    // Get the startup to find cohort
    const startup = await ctx.db.get(startupIds[0])
    if (!startup) return []

    // Fetch AccelerateMe template for this cohort
    const templates = await ctx.db
      .query('goalTemplates')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', startup.cohortId))
      .collect()

    const amTemplate = templates.find(
      (t) => t.title === 'Join AccelerateMe' || t.title?.toLowerCase().includes('join accelerateme')
    )

    // Fetch all goals for these startups
    const allGoals = []
    for (const startupId of startupIds) {
      const goals = await ctx.db
        .query('startupGoals')
        .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
        .collect()
      allGoals.push(...goals)
    }

    // Enrich with template sort order
    const enriched = await Promise.all(
      allGoals.map(async (goal) => {
        let sortOrder: number | null = null
        if (goal.goalTemplateId) {
          const template = await ctx.db.get(goal.goalTemplateId)
          sortOrder = template?.sortOrder ?? null
        }
        return { ...goal, templateSortOrder: sortOrder }
      })
    )

    // Sort by template sort order, then creation time
    enriched.sort((a, b) => {
      if (a.templateSortOrder !== null && b.templateSortOrder !== null) {
        return a.templateSortOrder - b.templateSortOrder
      }
      if (a.templateSortOrder !== null) return -1
      if (b.templateSortOrder !== null) return 1
      return a._creationTime - b._creationTime
    })

    // Prepend AccelerateMe goal
    const accelerateMeGoal = {
      _id: 'goal-join-accelerateme' as never,
      _creationTime: 0,
      startupId: startupIds[0],
      goalTemplateId: amTemplate?._id ?? null,
      title: amTemplate?.title ?? 'Join AccelerateMe',
      description: amTemplate?.description ?? 'Welcome to the program! Your journey starts here.',
      category: amTemplate?.category ?? 'launch',
      status: 'completed' as const,
      progressValue: 1,
      targetValue: 1,
      weight: 0,
      fundingAmount: amTemplate?.defaultFundingAmount ?? undefined,
      deadline: amTemplate?.defaultDeadline ?? undefined,
      manuallyOverridden: false,
      templateSortOrder: 0,
    }

    return [accelerateMeGoal, ...enriched]
  },
})

/**
 * Update a startup goal's status/progress.
 */
export const updateStatus = mutation({
  args: {
    id: v.id('startupGoals'),
    status: v.optional(
      v.union(
        v.literal('not_started'),
        v.literal('in_progress'),
        v.literal('completed'),
        v.literal('waived')
      )
    ),
    progressValue: v.optional(v.number()),
    manuallyOverridden: v.optional(v.boolean()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)
    const goal = await ctx.db.get(args.id)
    if (!goal) throw new Error('Goal not found')

    const previousStatus = goal.status
    const previousProgress = goal.progressValue

    const patch: Record<string, unknown> = {}
    if (args.status !== undefined) patch.status = args.status
    if (args.progressValue !== undefined) patch.progressValue = args.progressValue
    if (args.manuallyOverridden !== undefined) patch.manuallyOverridden = args.manuallyOverridden

    // If completing, set completion metadata
    if (args.status === 'completed') {
      patch.completionSource = 'manual'
    }

    await ctx.db.patch(args.id, patch)

    // Create audit trail
    await ctx.db.insert('goalUpdates', {
      startupGoalId: args.id,
      userId: user._id,
      previousStatus,
      newStatus: args.status,
      previousProgress,
      newProgress: args.progressValue,
      comment: args.comment,
    })
  },
})

/**
 * Update all fields of a startup goal (admin).
 */
export const update = mutation({
  args: {
    id: v.id('startupGoals'),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    targetValue: v.optional(v.number()),
    deadline: v.optional(v.string()),
    weight: v.optional(v.number()),
    fundingAmount: v.optional(v.number()),
    status: v.union(
      v.literal('not_started'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('waived')
    ),
    progressValue: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx)
    const goal = await ctx.db.get(args.id)
    if (!goal) throw new Error('Goal not found')

    const previousStatus = goal.status
    const previousProgress = goal.progressValue

    const { id, ...fields } = args
    await ctx.db.patch(id, {
      ...fields,
      weight: fields.weight ?? goal.weight,
      progressValue: fields.progressValue ?? goal.progressValue,
    })

    // Create audit trail
    await ctx.db.insert('goalUpdates', {
      startupGoalId: id,
      userId: user._id,
      previousStatus,
      newStatus: args.status,
      previousProgress,
      newProgress: args.progressValue,
    })
  },
})

/**
 * Delete a startup goal (admin).
 */
export const remove = mutation({
  args: { id: v.id('startupGoals') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const goal = await ctx.db.get(args.id)
    if (!goal) throw new Error('Goal not found')
    await ctx.db.delete(args.id)
  },
})

// ── Internal: Goal progress checking (cron) ─────────────────────────

/**
 * Get all metric-based goals that are eligible for auto-evaluation.
 */
export const getMetricBasedGoals = internalQuery({
  args: {},
  handler: async (ctx) => {
    const goals = await ctx.db.query('startupGoals').collect()

    return goals.filter(
      (g) =>
        (g.status === 'not_started' || g.status === 'in_progress') &&
        !g.manuallyOverridden &&
        (g.dataSource || g.goalTemplateId)
    )
  },
})

/**
 * Get latest metric value (internal, no auth check).
 */
export const getLatestMetricInternal = internalQuery({
  args: {
    startupId: v.id('startups'),
    provider: v.union(v.literal('stripe'), v.literal('tracker')),
    metricKey: v.string(),
    window: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
  },
  handler: async (ctx, args) => {
    const metrics = await ctx.db
      .query('metricsData')
      .withIndex('by_startupId_provider_metricKey', (q) =>
        q
          .eq('startupId', args.startupId)
          .eq('provider', args.provider)
          .eq('metricKey', args.metricKey)
      )
      .filter((q) => q.eq(q.field('window'), args.window))
      .collect()

    if (metrics.length === 0) return null

    metrics.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    return metrics[0].value
  },
})

/**
 * Update a goal's status/progress from the cron job (no auth required).
 */
export const updateGoalFromCron = internalMutation({
  args: {
    goalId: v.id('startupGoals'),
    status: v.optional(
      v.union(
        v.literal('not_started'),
        v.literal('in_progress'),
        v.literal('completed'),
        v.literal('waived')
      )
    ),
    progressValue: v.optional(v.number()),
    completionSource: v.optional(v.union(v.literal('auto'), v.literal('manual'))),
    lastMetricCheckAt: v.optional(v.string()),
    autoCompletedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { goalId, ...patch } = args

    // Remove undefined values
    const cleanPatch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) cleanPatch[key] = value
    }

    await ctx.db.patch(goalId, cleanPatch)
  },
})

/**
 * Parse conditions from a goal template's description.
 * Format: <!-- CONDITIONS_JSON:[...] -->
 */
function parseConditionsFromDescription(description: string | undefined): Array<{
  dataSource: string
  metric: string
  operator: string
  targetValue: number
  unit: string
}> {
  if (!description) return []

  const match = description.match(/<!-- CONDITIONS_JSON:(.+?) -->/)
  if (!match) return []

  try {
    return JSON.parse(match[1])
  } catch {
    return []
  }
}

/**
 * Evaluate a single condition against a metric value.
 */
function evaluateCondition(
  operator: string,
  currentValue: number | null,
  targetValue: number
): { met: boolean; progress: number } {
  if (currentValue === null) return { met: false, progress: 0 }

  let met = false
  let progress = 0

  switch (operator) {
    case '>=':
      met = currentValue >= targetValue
      progress = targetValue > 0 ? Math.min(currentValue / targetValue, 1) : 0
      break
    case '>':
      met = currentValue > targetValue
      progress = targetValue > 0 ? Math.min(currentValue / targetValue, 1) : 0
      break
    case '=':
      met = Math.abs(currentValue - targetValue) < 0.01
      progress = met ? 1 : targetValue > 0 ? Math.min(currentValue / targetValue, 1) : 0
      break
    case '<=':
      met = currentValue <= targetValue
      progress = currentValue > 0 ? Math.min(1, targetValue / currentValue) : 0
      break
    case '<':
      met = currentValue < targetValue
      progress = currentValue > 0 ? Math.min(1, targetValue / currentValue) : 0
      break
    case 'increased_by':
      met = currentValue >= targetValue
      progress = targetValue > 0 ? Math.min(currentValue / targetValue, 1) : 0
      break
    case 'decreased_by':
      met = currentValue <= targetValue
      progress = currentValue > 0 ? Math.min(1, targetValue / currentValue) : 0
      break
    default:
      met = currentValue >= targetValue
      progress = targetValue > 0 ? Math.min(currentValue / targetValue, 1) : 0
  }

  return { met, progress }
}

/**
 * Check goal progress for all metric-based goals.
 * Called by cron every 6 hours.
 */
export const checkAllGoalProgress = internalAction({
  args: {},
  handler: async (ctx) => {
    const goals: any[] = await ctx.runQuery(internal.startupGoals.getMetricBasedGoals)

    for (const goal of goals) {
      try {
        // Build conditions from template or direct configuration
        let conditions: Array<{
          dataSource: string
          metric: string
          operator: string
          targetValue: number
        }> = []

        if (goal.goalTemplateId) {
          const template: any = await ctx.runQuery(internal.startupGoals.getGoalTemplateInternal, {
            templateId: goal.goalTemplateId,
          })

          if (template) {
            const parsed = parseConditionsFromDescription(template.description)
            conditions = parsed.map((c) => ({
              dataSource: c.dataSource,
              metric: c.metric,
              operator: c.operator,
              targetValue: c.targetValue,
            }))
          }
        }

        // If no conditions from template, check direct metric config
        if (
          conditions.length === 0 &&
          goal.dataSource &&
          goal.metricKey &&
          goal.targetValueMetric
        ) {
          conditions = [
            {
              dataSource: goal.dataSource,
              metric: goal.metricKey,
              operator: goal.comparisonOperator || '>=',
              targetValue: goal.targetValueMetric,
            },
          ]
        }

        if (conditions.length === 0) continue

        // Evaluate each condition
        let allMet = true
        let totalProgress = 0

        for (const condition of conditions) {
          if (condition.dataSource === 'other') continue

          const provider = condition.dataSource as 'stripe' | 'tracker'
          const value = await ctx.runQuery(internal.startupGoals.getLatestMetricInternal, {
            startupId: goal.startupId,
            provider,
            metricKey: condition.metric,
            window: goal.aggregationWindow || 'daily',
          })

          const { met, progress } = evaluateCondition(
            condition.operator,
            value,
            condition.targetValue
          )

          if (!met) allMet = false
          totalProgress += progress
        }

        const avgProgress = Math.round((totalProgress / conditions.length) * 100)
        const now = new Date().toISOString()

        // Determine status update
        if (allMet && goal.status !== 'completed') {
          await ctx.runMutation(internal.startupGoals.updateGoalFromCron, {
            goalId: goal._id,
            status: 'completed',
            progressValue: 100,
            completionSource: 'auto',
            autoCompletedAt: now,
            lastMetricCheckAt: now,
          })
        } else if (!allMet && goal.status === 'not_started' && avgProgress > 0) {
          await ctx.runMutation(internal.startupGoals.updateGoalFromCron, {
            goalId: goal._id,
            status: 'in_progress',
            progressValue: avgProgress,
            lastMetricCheckAt: now,
          })
        } else if (avgProgress !== goal.progressValue) {
          // Update progress even if status doesn't change
          await ctx.runMutation(internal.startupGoals.updateGoalFromCron, {
            goalId: goal._id,
            progressValue: avgProgress,
            lastMetricCheckAt: now,
          })
        }
      } catch (error) {
        console.error(`Error checking goal ${goal._id}:`, error)
      }
    }
  },
})

/**
 * Get a goal template by ID (internal, no auth).
 */
export const getGoalTemplateInternal = internalQuery({
  args: { templateId: v.id('goalTemplates') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.templateId)
  },
})
