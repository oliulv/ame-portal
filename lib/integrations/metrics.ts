import { createAdminClient } from '@/lib/supabase/admin'
import { MetricSnapshot } from '@/lib/types'

/**
 * Store metric snapshots in the database
 */
export async function storeMetrics(snapshots: MetricSnapshot[]): Promise<void> {
  const supabase = createAdminClient()

  const metricsToInsert = snapshots.map((snapshot) => ({
    startup_id: snapshot.startup_id,
    provider: snapshot.provider,
    metric_key: snapshot.metric_key,
    value: snapshot.value,
    timestamp: snapshot.timestamp.toISOString(),
    window: snapshot.window,
    meta: snapshot.meta || null,
  }))

  // Upsert metrics (update if exists for same startup/provider/metric_key/timestamp/window)
  // Note: This assumes a unique constraint on (startup_id, provider, metric_key, timestamp, window)
  // If not, we'll insert and handle duplicates gracefully
  const { error } = await supabase
    .from('metrics_data')
    .upsert(metricsToInsert, {
      onConflict: 'startup_id,provider,metric_key,timestamp,window',
      ignoreDuplicates: false,
    })

  if (error) {
    console.error('Error storing metrics:', error)
    throw new Error('Failed to store metrics')
  }
}

/**
 * Get latest metric value for a startup/provider/metric combination
 */
export async function getLatestMetric(
  startupId: string,
  provider: 'stripe' | 'tracker',
  metricKey: string,
  window: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<number | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('metrics_data')
    .select('value')
    .eq('startup_id', startupId)
    .eq('provider', provider)
    .eq('metric_key', metricKey)
    .eq('window', window)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data.value
}

/**
 * Get metric time series for a startup/provider/metric combination
 */
export async function getMetricTimeSeries(
  startupId: string,
  provider: 'stripe' | 'tracker' | 'manual',
  metricKey: string,
  window: 'daily' | 'weekly' | 'monthly' = 'daily',
  startDate?: Date,
  endDate?: Date
): Promise<Array<{ timestamp: string; value: number }>> {
  const supabase = createAdminClient()

  let query = supabase
    .from('metrics_data')
    .select('timestamp, value')
    .eq('startup_id', startupId)
    .eq('provider', provider)
    .eq('metric_key', metricKey)
    .eq('window', window)
    .order('timestamp', { ascending: true })

  if (startDate) {
    query = query.gte('timestamp', startDate.toISOString())
  }

  if (endDate) {
    query = query.lte('timestamp', endDate.toISOString())
  }

  const { data, error } = await query

  if (error || !data) {
    return []
  }

  return data.map((row) => ({
    timestamp: row.timestamp,
    value: row.value,
  }))
}

