import { query } from './functions'
import { v } from 'convex/values'
import { requireAuth } from './auth'

/**
 * Real-time active users: sessions with activity in last 5 minutes.
 */
export const realtimeActiveUsers = query({
  args: { websiteIds: v.array(v.id('trackerWebsites')) },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    const activeSessions = new Set<string>()

    const eventSets = await Promise.all(
      args.websiteIds.map((websiteId) =>
        ctx.db
          .query('trackerEvents')
          .withIndex('by_websiteId', (q) => q.eq('websiteId', websiteId))
          .order('desc')
          .collect()
      )
    )

    for (const events of eventSets) {
      for (const event of events) {
        if (event._creationTime < fiveMinAgo) break
        if (event.sessionId) activeSessions.add(event.sessionId)
      }
    }

    return activeSessions.size
  },
})

/**
 * Stats summary with period comparison.
 */
export const statsSummary = query({
  args: {
    websiteIds: v.array(v.id('trackerWebsites')),
    startDate: v.string(),
    endDate: v.string(),
    compareStartDate: v.optional(v.string()),
    compareEndDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const startTime = new Date(args.startDate).getTime()
    const endTime = new Date(args.endDate).getTime()

    const eventSets = await Promise.all(
      args.websiteIds.map((websiteId) =>
        ctx.db
          .query('trackerEvents')
          .withIndex('by_websiteId', (q) => q.eq('websiteId', websiteId))
          .collect()
      )
    )
    const allEvents = eventSets.flat()

    const currentEvents = allEvents.filter(
      (e) => e._creationTime >= startTime && e._creationTime < endTime
    )

    const pageviews = currentEvents.filter((e) => !e.eventName).length
    const sessions = new Set(currentEvents.map((e) => e.sessionId).filter(Boolean)).size
    const uniqueVisitors = sessions // Approximation
    const bounces = computeBounces(currentEvents)
    const totalTime = computeTotalTime(currentEvents)

    let comparison = null
    if (args.compareStartDate && args.compareEndDate) {
      const compStart = new Date(args.compareStartDate).getTime()
      const compEnd = new Date(args.compareEndDate).getTime()
      const compEvents = allEvents.filter(
        (e) => e._creationTime >= compStart && e._creationTime < compEnd
      )

      const compPageviews = compEvents.filter((e) => !e.eventName).length
      const compSessions = new Set(compEvents.map((e) => e.sessionId).filter(Boolean)).size

      comparison = {
        pageviews: compPageviews,
        sessions: compSessions,
        pageviewsChange:
          compPageviews > 0 ? ((pageviews - compPageviews) / compPageviews) * 100 : 0,
        sessionsChange: compSessions > 0 ? ((sessions - compSessions) / compSessions) * 100 : 0,
      }
    }

    return { pageviews, sessions, uniqueVisitors, bounces, totalTime, comparison }
  },
})

/**
 * Pageviews grouped by time bucket.
 */
export const pageviewsByTime = query({
  args: {
    websiteIds: v.array(v.id('trackerWebsites')),
    startDate: v.string(),
    endDate: v.string(),
    granularity: v.union(
      v.literal('hour'),
      v.literal('day'),
      v.literal('week'),
      v.literal('month')
    ),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const startTime = new Date(args.startDate).getTime()
    const endTime = new Date(args.endDate).getTime()

    const eventSets = await Promise.all(
      args.websiteIds.map((websiteId) =>
        ctx.db
          .query('trackerEvents')
          .withIndex('by_websiteId', (q) => q.eq('websiteId', websiteId))
          .collect()
      )
    )
    const allEvents = eventSets.flat()

    const filtered = allEvents.filter(
      (e) => !e.eventName && e._creationTime >= startTime && e._creationTime < endTime
    )

    const buckets = new Map<string, { pageviews: number; sessions: Set<string> }>()

    for (const event of filtered) {
      const key = getBucketKey(event._creationTime, args.granularity)
      if (!buckets.has(key)) buckets.set(key, { pageviews: 0, sessions: new Set() })
      const b = buckets.get(key)!
      b.pageviews++
      if (event.sessionId) b.sessions.add(event.sessionId)
    }

    return Array.from(buckets.entries())
      .map(([key, data]) => ({
        timestamp: key,
        pageviews: data.pageviews,
        sessions: data.sessions.size,
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  },
})

/**
 * Dimension breakdowns (top pages, referrers, browsers, OS, devices, countries).
 */
export const dimensionBreakdown = query({
  args: {
    websiteIds: v.array(v.id('trackerWebsites')),
    startDate: v.string(),
    endDate: v.string(),
    dimension: v.union(
      v.literal('url'),
      v.literal('referrer'),
      v.literal('browser'),
      v.literal('os'),
      v.literal('device'),
      v.literal('country')
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const startTime = new Date(args.startDate).getTime()
    const endTime = new Date(args.endDate).getTime()
    const maxItems = args.limit ?? 10

    const eventSets = await Promise.all(
      args.websiteIds.map((websiteId) =>
        ctx.db
          .query('trackerEvents')
          .withIndex('by_websiteId', (q) => q.eq('websiteId', websiteId))
          .collect()
      )
    )
    const allEvents = eventSets.flat()

    const filtered = allEvents.filter(
      (e) => !e.eventName && e._creationTime >= startTime && e._creationTime < endTime
    )

    const counts = new Map<string, number>()
    for (const event of filtered) {
      const value = getDimensionValue(event, args.dimension)
      if (value) {
        counts.set(value, (counts.get(value) ?? 0) + 1)
      }
    }

    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, maxItems)
  },
})

/**
 * Session list with activity count per session.
 */
export const sessionList = query({
  args: {
    websiteIds: v.array(v.id('trackerWebsites')),
    startDate: v.string(),
    endDate: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const startTime = new Date(args.startDate).getTime()
    const endTime = new Date(args.endDate).getTime()
    const maxItems = args.limit ?? 50

    const eventSets = await Promise.all(
      args.websiteIds.map((websiteId) =>
        ctx.db
          .query('trackerEvents')
          .withIndex('by_websiteId', (q) => q.eq('websiteId', websiteId))
          .collect()
      )
    )
    const allEvents = eventSets.flat()

    const filtered = allEvents.filter(
      (e) => e._creationTime >= startTime && e._creationTime < endTime && e.sessionId
    )

    // Group by session
    const sessions = new Map<
      string,
      {
        firstSeen: number
        lastSeen: number
        pageviews: number
        events: number
        country?: string
        device?: string
        browser?: string
      }
    >()

    for (const event of filtered) {
      const sid = event.sessionId!
      const existing = sessions.get(sid)
      if (existing) {
        existing.lastSeen = Math.max(existing.lastSeen, event._creationTime)
        existing.firstSeen = Math.min(existing.firstSeen, event._creationTime)
        if (!event.eventName) existing.pageviews++
        else existing.events++
      } else {
        sessions.set(sid, {
          firstSeen: event._creationTime,
          lastSeen: event._creationTime,
          pageviews: event.eventName ? 0 : 1,
          events: event.eventName ? 1 : 0,
          country: event.country,
          device: event.device,
          browser: event.browser,
        })
      }
    }

    return Array.from(sessions.entries())
      .map(([sessionId, data]) => ({
        sessionId,
        ...data,
        duration: data.lastSeen - data.firstSeen,
        startedAt: new Date(data.firstSeen).toISOString(),
      }))
      .sort((a, b) => b.firstSeen - a.firstSeen)
      .slice(0, maxItems)
  },
})

// ── Helpers ──────────────────────────────────────────────────────────

function getBucketKey(timestamp: number, granularity: string): string {
  const d = new Date(timestamp)
  switch (granularity) {
    case 'hour':
      return `${d.toISOString().slice(0, 13)}:00:00.000Z`
    case 'day':
      return `${d.toISOString().slice(0, 10)}T00:00:00.000Z`
    case 'week': {
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      d.setDate(diff)
      return `${d.toISOString().slice(0, 10)}T00:00:00.000Z`
    }
    case 'month':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`
    default:
      return d.toISOString().slice(0, 10) + 'T00:00:00.000Z'
  }
}

function getDimensionValue(event: any, dimension: string): string | undefined {
  switch (dimension) {
    case 'url':
      return event.url
    case 'referrer':
      return event.referrer || undefined
    case 'browser':
      return event.browser || undefined
    case 'os':
      return event.os || undefined
    case 'device':
      return event.device || undefined
    case 'country':
      return event.country || undefined
    default:
      return undefined
  }
}

function computeBounces(events: any[]): number {
  // Bounce = session with only 1 pageview
  const sessionPageviews = new Map<string, number>()
  for (const e of events) {
    if (e.sessionId && !e.eventName) {
      sessionPageviews.set(e.sessionId, (sessionPageviews.get(e.sessionId) ?? 0) + 1)
    }
  }
  return Array.from(sessionPageviews.values()).filter((count) => count === 1).length
}

function computeTotalTime(events: any[]): number {
  // Sum of session durations (last event - first event per session)
  const sessions = new Map<string, { first: number; last: number }>()
  for (const e of events) {
    if (!e.sessionId) continue
    const existing = sessions.get(e.sessionId)
    if (existing) {
      existing.first = Math.min(existing.first, e._creationTime)
      existing.last = Math.max(existing.last, e._creationTime)
    } else {
      sessions.set(e.sessionId, { first: e._creationTime, last: e._creationTime })
    }
  }
  return Array.from(sessions.values()).reduce((sum, s) => sum + (s.last - s.first), 0)
}
