import { createAdminClient } from '@/lib/supabase/admin'
import { MetricSnapshot } from '@/lib/types'
import { subDays, subWeeks, subMonths } from 'date-fns'

/**
 * Fetch tracker metrics for a startup
 * Aggregates tracker_events into metric snapshots
 */
export async function fetchTrackerMetrics(
  startupId: string,
  window: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<MetricSnapshot[]> {
  const supabase = createAdminClient()
  const now = new Date()

  // Calculate date range based on window
  let startDate: Date
  switch (window) {
    case 'daily':
      startDate = subDays(now, 30)
      break
    case 'weekly':
      startDate = subWeeks(now, 12)
      break
    case 'monthly':
      startDate = subMonths(now, 12)
      break
  }

  // Get all tracker websites for this startup
  const { data: websites } = await supabase
    .from('tracker_websites')
    .select('id')
    .eq('startup_id', startupId)

  if (!websites || websites.length === 0) {
    return []
  }

  const websiteIds = websites.map((w) => w.id)

  // Aggregate events by time period
  const snapshots: MetricSnapshot[] = []

  try {
    // Get pageviews (events where event_name is NULL)
    const { data: pageviewEvents } = await supabase
      .from('tracker_events')
      .select('created_at')
      .in('website_id', websiteIds)
      .is('event_name', null)
      .gte('created_at', startDate.toISOString())

    // Get sessions (unique session_ids)
    const { data: sessionEvents } = await supabase
      .from('tracker_events')
      .select('session_id, created_at')
      .in('website_id', websiteIds)
      .gte('created_at', startDate.toISOString())

    // Get unique users (unique session_ids, could be improved with visitor ID)
    const _uniqueSessions = new Set(sessionEvents?.map((e) => e.session_id).filter(Boolean) || [])

    // Aggregate by time window
    const timeBuckets = new Map<
      string,
      {
        pageviews: number
        sessions: number
        users: number
      }
    >()

    // Process pageviews
    pageviewEvents?.forEach((event) => {
      const bucket = getTimeBucket(new Date(event.created_at), window)
      const current = timeBuckets.get(bucket) || { pageviews: 0, sessions: 0, users: 0 }
      current.pageviews++
      timeBuckets.set(bucket, current)
    })

    // Process sessions
    sessionEvents?.forEach((event) => {
      if (event.session_id) {
        const bucket = getTimeBucket(new Date(event.created_at), window)
        const current = timeBuckets.get(bucket) || { pageviews: 0, sessions: 0, users: 0 }
        current.sessions++
        timeBuckets.set(bucket, current)
      }
    })

    // For users, we'll use unique sessions per bucket
    const sessionBuckets = new Map<string, Set<string>>()
    sessionEvents?.forEach((event) => {
      if (event.session_id) {
        const bucket = getTimeBucket(new Date(event.created_at), window)
        if (!sessionBuckets.has(bucket)) {
          sessionBuckets.set(bucket, new Set())
        }
        sessionBuckets.get(bucket)!.add(event.session_id)
      }
    })

    // Create snapshots
    timeBuckets.forEach((values, bucket) => {
      const timestamp = parseTimeBucket(bucket, window)
      const uniqueUsers = sessionBuckets.get(bucket)?.size || 0

      snapshots.push({
        startup_id: startupId,
        provider: 'tracker',
        metric_key: 'pageviews',
        value: values.pageviews,
        timestamp,
        window,
      })

      snapshots.push({
        startup_id: startupId,
        provider: 'tracker',
        metric_key: 'sessions',
        value: values.sessions,
        timestamp,
        window,
      })

      snapshots.push({
        startup_id: startupId,
        provider: 'tracker',
        metric_key: 'weekly_active_users',
        value: uniqueUsers,
        timestamp,
        window,
      })
    })
  } catch (error) {
    console.error('Error fetching tracker metrics:', error)
    throw error
  }

  return snapshots
}

/**
 * Get time bucket key for aggregation
 */
function getTimeBucket(date: Date, window: 'daily' | 'weekly' | 'monthly'): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  switch (window) {
    case 'daily':
      return `${year}-${month}-${day}`
    case 'weekly':
      // Get ISO week
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      return `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate() + 1) / 7)).padStart(2, '0')}`
    case 'monthly':
      return `${year}-${month}`
  }
}

/**
 * Parse time bucket back to Date
 */
function parseTimeBucket(bucket: string, window: 'daily' | 'weekly' | 'monthly'): Date {
  switch (window) {
    case 'daily':
      return new Date(bucket + 'T00:00:00Z')
    case 'weekly':
      // Simplified - assumes format YYYY-WXX
      const [year, week] = bucket.split('-W')
      const date = new Date(parseInt(year), 0, 1)
      date.setDate(date.getDate() + (parseInt(week) - 1) * 7)
      return date
    case 'monthly':
      return new Date(bucket + '-01T00:00:00Z')
  }
}
