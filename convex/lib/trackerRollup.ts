const DAY_MS = 86_400_000

export const TRACKER_ROLLUP_DAYS = 30

export interface TrackerRollupEvent {
  _creationTime: number
  eventName?: string
  sessionId?: string
}

export interface TrackerDailyMetric {
  metricKey: 'pageviews' | 'sessions' | 'weekly_active_users'
  value: number
  timestamp: string
}

export function trackerRollupWindow(nowMs: number = Date.now()): {
  startMs: number
  endMs: number
} {
  const todayStart = utcDayStartMs(nowMs)
  return {
    startMs: todayStart - (TRACKER_ROLLUP_DAYS - 1) * DAY_MS,
    endMs: todayStart + DAY_MS,
  }
}

export function buildTrackerDailyMetrics(
  events: TrackerRollupEvent[],
  window: { startMs: number; endMs: number }
): TrackerDailyMetric[] {
  const startMs = utcDayStartMs(window.startMs)
  const endMs = utcDayStartMs(window.endMs - 1) + DAY_MS
  const buckets = new Map<string, { pageviews: number; sessions: Set<string> }>()

  for (let t = startMs; t < endMs; t += DAY_MS) {
    buckets.set(utcDayKeyFromMs(t), { pageviews: 0, sessions: new Set() })
  }

  for (const event of events) {
    if (event._creationTime < startMs || event._creationTime >= endMs) continue
    const bucket = utcDayKeyFromMs(event._creationTime)
    const data = buckets.get(bucket)
    if (!data) continue

    if (!event.eventName) data.pageviews++
    if (event.sessionId) data.sessions.add(event.sessionId)
  }

  const snapshots: TrackerDailyMetric[] = []
  for (const [day, data] of buckets) {
    const timestamp = `${day}T00:00:00.000Z`
    snapshots.push(
      { metricKey: 'pageviews', value: data.pageviews, timestamp },
      { metricKey: 'sessions', value: data.sessions.size, timestamp },
      { metricKey: 'weekly_active_users', value: data.sessions.size, timestamp }
    )
  }
  return snapshots
}

export function utcDayKeyFromMs(epochMs: number): string {
  const d = new Date(epochMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function utcDayStartMs(epochMs: number): number {
  const d = new Date(epochMs)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
