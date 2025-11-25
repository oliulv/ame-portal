/**
 * Configuration for goal template data sources and metrics
 * Defines available metrics for each data source and their associated units
 */

export type DataSource = 'stripe' | 'tracker' | 'other'

export interface MetricConfig {
  id: string
  label: string
  description?: string
  unit: string
}

export interface DataSourceConfig {
  id: DataSource
  label: string
  description?: string
  metrics: MetricConfig[]
}

/**
 * Stripe metrics configuration
 */
const stripeMetrics: MetricConfig[] = [
  {
    id: 'mrr',
    label: 'Monthly Recurring Revenue',
    description: 'Total monthly recurring revenue',
    unit: 'GBP',
  },
  {
    id: 'total_revenue',
    label: 'Total Revenue',
    description: 'Cumulative revenue across all time',
    unit: 'GBP',
  },
  {
    id: 'active_customers',
    label: 'Active Customers',
    description: 'Number of active paying customers',
    unit: 'users',
  },
]

/**
 * Tracker (AccelerateMe Tracker) metrics configuration
 */
const trackerMetrics: MetricConfig[] = [
  {
    id: 'weekly_active_users',
    label: 'Weekly Active Users',
    description: 'Number of unique users active in the past 7 days',
    unit: 'users',
  },
  {
    id: 'monthly_active_users',
    label: 'Monthly Active Users',
    description: 'Number of unique users active in the past 30 days',
    unit: 'users',
  },
  {
    id: 'pageviews',
    label: 'Pageviews',
    description: 'Total number of page views',
    unit: 'views',
  },
  {
    id: 'sessions',
    label: 'Sessions',
    description: 'Total number of user sessions',
    unit: 'sessions',
  },
]

/**
 * Complete data source configuration
 */
export const dataSourceConfigs: DataSourceConfig[] = [
  {
    id: 'stripe',
    label: 'Stripe',
    description: 'Payment and subscription metrics from Stripe',
    metrics: stripeMetrics,
  },
  {
    id: 'tracker',
    label: 'AccelerateMe Tracker',
    description: 'Website analytics from AccelerateMe Tracker',
    metrics: trackerMetrics,
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Custom metric from another data source',
    metrics: [], // No predefined metrics for 'other'
  },
]

/**
 * Get metrics for a specific data source
 */
export function getMetricsForDataSource(dataSource: DataSource): MetricConfig[] {
  const config = dataSourceConfigs.find((ds) => ds.id === dataSource)
  return config?.metrics || []
}

/**
 * Get a specific metric by ID and data source
 */
export function getMetric(dataSource: DataSource, metricId: string): MetricConfig | undefined {
  const metrics = getMetricsForDataSource(dataSource)
  return metrics.find((m) => m.id === metricId)
}

/**
 * Get unit for a specific metric
 */
export function getUnitForMetric(dataSource: DataSource, metricId: string): string | undefined {
  const metric = getMetric(dataSource, metricId)
  return metric?.unit
}

/**
 * Check if a data source supports predefined metrics
 */
export function hasPredefinedMetrics(dataSource: DataSource): boolean {
  return dataSource !== 'other'
}

/**
 * Get all data sources for dropdown options
 */
export function getDataSourceOptions() {
  return dataSourceConfigs.map((ds) => ({
    value: ds.id,
    label: ds.label,
    description: ds.description,
  }))
}

/**
 * Get metric options for a data source (for dropdown)
 */
export function getMetricOptions(dataSource: DataSource) {
  const metrics = getMetricsForDataSource(dataSource)
  return metrics.map((m) => ({
    value: m.id,
    label: m.label,
    description: m.description,
    unit: m.unit,
  }))
}

/**
 * Condition evaluation types
 */
export interface MetricCondition {
  dataSource: DataSource
  metric: string
  operator: '>=' | '>' | '=' | '<=' | '<' | 'increased_by' | 'decreased_by'
  targetValue: number
  unit: string
}

export interface MetricRequirement {
  startupId: string
  provider: 'stripe' | 'tracker'
  metricKey: string
  window: 'daily' | 'weekly' | 'monthly'
  operator: '>=' | '>' | '=' | '<=' | '<' | 'increased_by' | 'decreased_by'
  targetValue: number
}

export interface GoalEvaluationResult {
  completed: boolean
  progress: number // 0-1
  currentValue?: number
  targetValue: number
  breakdown?: Array<{
    condition: MetricCondition
    met: boolean
    currentValue?: number
  }>
}

/**
 * Translate a condition into a metric requirement
 */
export function conditionToRequirement(
  condition: MetricCondition,
  startupId: string,
  window: 'daily' | 'weekly' | 'monthly' = 'daily'
): MetricRequirement | null {
  if (condition.dataSource === 'other') {
    return null // Manual tracking only
  }

  return {
    startupId,
    provider: condition.dataSource === 'stripe' ? 'stripe' : 'tracker',
    metricKey: condition.metric,
    window,
    operator: condition.operator,
    targetValue: condition.targetValue,
  }
}

/**
 * Evaluate a single condition against a metric value
 */
export function evaluateCondition(
  condition: MetricCondition,
  currentValue: number | null
): { met: boolean; progress: number } {
  if (currentValue === null) {
    return { met: false, progress: 0 }
  }

  let met = false
  let progress = 0

  switch (condition.operator) {
    case '>=':
      met = currentValue >= condition.targetValue
      progress = Math.min(currentValue / condition.targetValue, 1)
      break
    case '>':
      met = currentValue > condition.targetValue
      progress = Math.min(currentValue / condition.targetValue, 1)
      break
    case '=':
      met = Math.abs(currentValue - condition.targetValue) < 0.01 // Allow small floating point differences
      progress = met ? 1 : Math.min(currentValue / condition.targetValue, 1)
      break
    case '<=':
      met = currentValue <= condition.targetValue
      progress = Math.min(1, condition.targetValue / currentValue)
      break
    case '<':
      met = currentValue < condition.targetValue
      progress = Math.min(1, condition.targetValue / currentValue)
      break
    case 'increased_by':
      // For increase operators, we'd need a baseline value
      // For now, treat as >= targetValue
      met = currentValue >= condition.targetValue
      progress = Math.min(currentValue / condition.targetValue, 1)
      break
    case 'decreased_by':
      // For decrease operators, we'd need a baseline value
      // For now, treat as <= targetValue
      met = currentValue <= condition.targetValue
      progress = Math.min(1, condition.targetValue / currentValue)
      break
  }

  return { met, progress }
}

/**
 * Evaluate multiple conditions (all must be met for goal completion)
 */
export function evaluateConditions(
  conditions: MetricCondition[],
  metricValues: Map<string, number | null>
): GoalEvaluationResult {
  if (conditions.length === 0) {
    return {
      completed: false,
      progress: 0,
      targetValue: 0,
    }
  }

  const breakdown = conditions.map((condition) => {
    const metricKey = `${condition.dataSource}:${condition.metric}`
    const currentValue = metricValues.get(metricKey) ?? null
    const evaluation = evaluateCondition(condition, currentValue)

    return {
      condition,
      met: evaluation.met,
      currentValue: currentValue ?? undefined,
    }
  })

  // All conditions must be met
  const completed = breakdown.every((b) => b.met)

  // Average progress across all conditions
  const avgProgress =
    breakdown.reduce((sum, b) => {
      const currentValue = b.currentValue ?? 0
      const _targetValue = b.condition.targetValue
      const evaluation = evaluateCondition(b.condition, currentValue)
      return sum + evaluation.progress
    }, 0) / breakdown.length

  // Use the first condition's target value as the primary target
  const targetValue = conditions[0].targetValue

  return {
    completed,
    progress: Math.min(avgProgress, 1),
    targetValue,
    breakdown,
  }
}
