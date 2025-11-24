/**
 * Configuration for goal template data sources and metrics
 * Defines available metrics for each data source and their associated units
 */

export type DataSource = 'stripe' | 'ga4' | 'other'

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
 * GA4 (Google Analytics 4) metrics configuration
 */
const ga4Metrics: MetricConfig[] = [
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
    id: 'ga4',
    label: 'Google Analytics 4',
    description: 'Website and app analytics from GA4',
    metrics: ga4Metrics,
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

