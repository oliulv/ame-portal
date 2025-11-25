import { createAdminClient } from '@/lib/supabase/admin'
import { StartupGoal, GoalTemplate } from '@/lib/types'
import { GoalTemplateCondition, GoalTemplateFormData } from '@/lib/schemas'
import {
  MetricCondition,
  GoalEvaluationResult,
  conditionToRequirement,
  evaluateConditions,
} from '@/lib/goalMetrics'
import { getLatestMetric } from '@/lib/integrations/metrics'
import { parseConditionsFromDescription } from '@/lib/goalUtils'

/**
 * Evaluate a goal using its associated conditions and current metric values
 */
export async function evaluateGoalForStartup(
  startupGoalId: string
): Promise<GoalEvaluationResult & { shouldUpdate: boolean; newStatus?: 'completed' | 'in_progress' }> {
  const supabase = createAdminClient()

  // Fetch the goal
  const { data: goal, error: goalError } = await supabase
    .from('startup_goals')
    .select('*')
    .eq('id', startupGoalId)
    .single()

  if (goalError || !goal) {
    throw new Error('Goal not found')
  }

  // Skip if manually overridden or already completed/waived
  if (goal.manually_overridden || goal.status === 'completed' || goal.status === 'waived') {
    return {
      completed: goal.status === 'completed',
      progress: goal.progress_value / 100,
      targetValue: goal.target_value_metric || goal.target_value || 0,
      shouldUpdate: false,
    }
  }

  // Get conditions from goal template if available
  let conditions: MetricCondition[] = []

  if (goal.goal_template_id) {
    const { data: template } = await supabase
      .from('goal_templates')
      .select('*')
      .eq('id', goal.goal_template_id)
      .single()

    if (template) {
      // Parse conditions from template description or conditions JSONB field
      const parsedConditions = parseConditionsFromDescription(template.description || '')
      if (parsedConditions.length > 0) {
        conditions = parsedConditions.map((c) => ({
          dataSource: c.dataSource as 'stripe' | 'tracker' | 'other',
          metric: c.metric,
          operator: c.operator,
          targetValue: c.targetValue,
          unit: c.unit,
        }))
      }
    }
  }

  // If no conditions from template, check if goal has direct metric configuration
  if (conditions.length === 0 && goal.data_source && goal.metric_key && goal.target_value_metric) {
    conditions = [
      {
        dataSource: goal.data_source,
        metric: goal.metric_key,
        operator: goal.comparison_operator || '>=',
        targetValue: goal.target_value_metric,
        unit: '', // Unit would need to be stored or inferred
      },
    ]
  }

  // If still no conditions, return current status
  if (conditions.length === 0) {
    return {
      completed: goal.status === 'completed',
      progress: goal.progress_value / 100,
      targetValue: goal.target_value || 0,
      shouldUpdate: false,
    }
  }

  // Fetch metric values for all conditions
  const metricValues = new Map<string, number | null>()

  for (const condition of conditions) {
    if (condition.dataSource === 'other') {
      continue // Skip manual metrics
    }

    const requirement = conditionToRequirement(condition, goal.startup_id, goal.aggregation_window || 'daily')
    if (!requirement) {
      continue
    }

    const value = await getLatestMetric(
      requirement.startupId,
      requirement.provider,
      requirement.metricKey,
      requirement.window
    )

    const metricKey = `${condition.dataSource}:${condition.metric}`
    metricValues.set(metricKey, value)
  }

  // Evaluate conditions
  const result = evaluateConditions(conditions, metricValues)

  // Determine if status should be updated
  let shouldUpdate = false
  let newStatus: 'completed' | 'in_progress' | undefined

  if (result.completed && goal.status !== 'completed') {
    shouldUpdate = true
    newStatus = 'completed'
  } else if (!result.completed && goal.status === 'completed') {
    // Don't auto-uncomplete goals that were manually completed
    // Only update if it was auto-completed
    if (goal.completion_source === 'auto') {
      shouldUpdate = true
      newStatus = 'in_progress'
    }
  } else if (!result.completed && goal.status === 'not_started' && result.progress > 0) {
    shouldUpdate = true
    newStatus = 'in_progress'
  }

  return {
    ...result,
    shouldUpdate,
    newStatus,
  }
}

