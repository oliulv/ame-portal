import {
  query,
  mutation,
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from './functions'
import { api, internal } from './_generated/api'
import { v } from 'convex/values'
import { requireAuth } from './auth'
import { logConvexError } from './lib/logging'

/**
 * Store metric snapshots (upserts by day to avoid duplicates).
 */
export const store = mutation({
  args: {
    snapshots: v.array(
      v.object({
        startupId: v.id('startups'),
        provider: v.union(v.literal('stripe'), v.literal('tracker'), v.literal('manual')),
        metricKey: v.string(),
        value: v.number(),
        timestamp: v.string(),
        window: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
        meta: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const snapshot of args.snapshots) {
      const dayTs = snapshot.timestamp.slice(0, 10) + 'T00:00:00.000Z'

      const existing = await ctx.db
        .query('metricsData')
        .withIndex('by_startupId_provider_metricKey', (q) =>
          q
            .eq('startupId', snapshot.startupId)
            .eq('provider', snapshot.provider)
            .eq('metricKey', snapshot.metricKey)
        )
        .filter((q) => q.eq(q.field('timestamp'), dayTs))
        .first()

      if (existing) {
        await ctx.db.patch(existing._id, { value: snapshot.value, meta: snapshot.meta })
      } else {
        await ctx.db.insert('metricsData', { ...snapshot, timestamp: dayTs })
      }
    }
  },
})

/**
 * Get latest metric value for a startup/provider/metric.
 */
export const getLatest = query({
  args: {
    startupId: v.id('startups'),
    provider: v.union(v.literal('stripe'), v.literal('tracker'), v.literal('manual')),
    metricKey: v.string(),
    window: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

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

    // Sort by timestamp descending, return latest
    metrics.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    return metrics[0].value
  },
})

/**
 * Get metric time series.
 */
export const timeSeries = query({
  args: {
    startupId: v.id('startups'),
    provider: v.union(v.literal('stripe'), v.literal('tracker'), v.literal('manual')),
    metricKey: v.string(),
    window: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    let metrics = await ctx.db
      .query('metricsData')
      .withIndex('by_startupId_provider_metricKey', (q) =>
        q
          .eq('startupId', args.startupId)
          .eq('provider', args.provider)
          .eq('metricKey', args.metricKey)
      )
      .filter((q) => q.eq(q.field('window'), args.window))
      .collect()

    // Filter by date range
    if (args.startDate) {
      metrics = metrics.filter((m) => m.timestamp >= args.startDate!)
    }
    if (args.endDate) {
      metrics = metrics.filter((m) => m.timestamp <= args.endDate!)
    }

    // Dedup: keep latest value per day (handles pre-existing duplicates)
    const byDay = new Map<string, { timestamp: string; value: number }>()
    for (const m of metrics) {
      const day = m.timestamp.slice(0, 10)
      const existing = byDay.get(day)
      if (!existing || m.timestamp > existing.timestamp) {
        byDay.set(day, { timestamp: m.timestamp, value: m.value })
      }
    }

    return Array.from(byDay.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  },
})

/**
 * Manually sync metrics for a startup (admin-only).
 * Triggers both Stripe and tracker metric fetches.
 */
export const syncMetricsForStartup = action({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.current)
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      throw new Error('Admin access required')
    }

    const errors: string[] = []

    try {
      await ctx.runAction(internal.metrics.fetchStripeMetrics, {
        startupId: args.startupId,
      })
    } catch (error) {
      errors.push(`Stripe: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    try {
      await ctx.runAction(internal.metrics.fetchTrackerMetrics_cron, {
        startupId: args.startupId,
      })
    } catch (error) {
      errors.push(`Tracker: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    if (errors.length > 0) {
      throw new Error(`Sync completed with errors: ${errors.join('; ')}`)
    }
  },
})

/**
 * Auto-paginate a Stripe list endpoint, following `has_more` cursors.
 */
async function paginateStripe<T extends { id: string }>(
  listFn: (params: {
    limit: number
    starting_after?: string
  }) => Promise<{ data: T[]; has_more: boolean }>
): Promise<T[]> {
  const all: T[] = []
  let startingAfter: string | undefined
  let hasMore = true
  while (hasMore) {
    const page = await listFn({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    all.push(...page.data)
    hasMore = page.has_more
    if (page.data.length > 0) startingAfter = page.data[page.data.length - 1].id
  }
  return all
}

/**
 * Fetch and store Stripe metrics for a startup (action).
 */
export const fetchStripeMetrics = internalAction({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    // Get the connection
    const connection: any = await ctx.runQuery(internal.metrics.getStripeConnection, {
      startupId: args.startupId,
    })

    if (!connection?.accessToken) return

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(connection.accessToken, {
      apiVersion: '2025-11-17.clover',
    })

    const now = new Date()

    // Revenue: all-time charges, net of refunds
    const allCharges = await paginateStripe((p) => stripe.charges.list(p))
    const succeededCharges = allCharges.filter((c) => c.status === 'succeeded')
    const totalRevenue =
      succeededCharges.reduce((sum, c) => sum + ((c.amount || 0) - (c.amount_refunded || 0)), 0) /
      100

    // Active customers: unique customers from last 90 days
    const ninetyDaysAgo = Math.floor((now.getTime() - 90 * 24 * 60 * 60 * 1000) / 1000)
    const recentCharges = succeededCharges.filter((c) => c.created >= ninetyDaysAgo)
    const uniqueCustomers = new Set(
      recentCharges.map((c) => c.customer).filter((c): c is string => Boolean(c))
    ).size

    // MRR: all active subscriptions, all line items, multiply by quantity
    const allSubs = await paginateStripe((p) =>
      stripe.subscriptions.list({ ...p, status: 'active' })
    )
    let mrr = 0
    for (const sub of allSubs) {
      for (const item of sub.items.data) {
        const price = item.price
        const quantity = item.quantity ?? 1
        if (price?.recurring?.interval === 'month') {
          mrr += ((price.unit_amount || 0) * quantity) / 100
        } else if (price?.recurring?.interval === 'year') {
          mrr += ((price.unit_amount || 0) * quantity) / 100 / 12
        }
      }
    }

    const timestamp = now.toISOString()

    await ctx.runMutation(internal.metrics.storeInternal, {
      snapshots: [
        {
          startupId: args.startupId,
          provider: 'stripe',
          metricKey: 'total_revenue',
          value: totalRevenue,
          timestamp,
          window: 'daily',
        },
        {
          startupId: args.startupId,
          provider: 'stripe',
          metricKey: 'active_customers',
          value: uniqueCustomers,
          timestamp,
          window: 'daily',
        },
        {
          startupId: args.startupId,
          provider: 'stripe',
          metricKey: 'mrr',
          value: mrr,
          timestamp,
          window: 'daily',
        },
      ],
    })
  },
})

/**
 * Internal query to get Stripe connection for a startup.
 */
export const getStripeConnection = internalQuery({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId_provider', (q) =>
        q.eq('startupId', args.startupId).eq('provider', 'stripe')
      )
      .filter((q) => q.and(q.eq(q.field('isActive'), true), q.eq(q.field('status'), 'active')))
      .first()
  },
})

/**
 * Internal mutation to store metrics (used by actions).
 * Upserts by day to avoid duplicates.
 */
export const storeInternal = internalMutation({
  args: {
    snapshots: v.array(
      v.object({
        startupId: v.id('startups'),
        provider: v.union(v.literal('stripe'), v.literal('tracker'), v.literal('manual')),
        metricKey: v.string(),
        value: v.number(),
        timestamp: v.string(),
        window: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const snapshot of args.snapshots) {
      const dayTs = snapshot.timestamp.slice(0, 10) + 'T00:00:00.000Z'

      const existing = await ctx.db
        .query('metricsData')
        .withIndex('by_startupId_provider_metricKey', (q) =>
          q
            .eq('startupId', snapshot.startupId)
            .eq('provider', snapshot.provider)
            .eq('metricKey', snapshot.metricKey)
        )
        .filter((q) => q.eq(q.field('timestamp'), dayTs))
        .first()

      if (existing) {
        await ctx.db.patch(existing._id, { value: snapshot.value })
      } else {
        await ctx.db.insert('metricsData', { ...snapshot, timestamp: dayTs })
      }
    }
  },
})

// ── Internal queries for cron jobs ──────────────────────────────────

/**
 * Get all active Stripe integration connections.
 */
export const getAllActiveStripeConnections = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('integrationConnections')
      .filter((q) =>
        q.and(
          q.eq(q.field('provider'), 'stripe'),
          q.eq(q.field('isActive'), true),
          q.eq(q.field('status'), 'active')
        )
      )
      .collect()
  },
})

/**
 * Get all startups that have tracker websites.
 */
export const getStartupsWithTrackers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const websites = await ctx.db.query('trackerWebsites').collect()
    const startupIds = [...new Set(websites.map((w) => w.startupId))]
    return startupIds
  },
})

/**
 * Update integration connection sync status.
 */
export const updateConnectionSyncStatus = internalMutation({
  args: {
    connectionId: v.id('integrationConnections'),
    status: v.optional(v.union(v.literal('active'), v.literal('error'), v.literal('disconnected'))),
    syncError: v.optional(v.string()),
    lastSyncedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {}
    if (args.status !== undefined) patch.status = args.status
    if (args.syncError !== undefined) patch.syncError = args.syncError
    if (args.lastSyncedAt !== undefined) patch.lastSyncedAt = args.lastSyncedAt
    await ctx.db.patch(args.connectionId, patch)
  },
})

// ── Sync all metrics (cron job) ─────────────────────────────────────

/**
 * Sync metrics from all active integrations (Stripe + Tracker).
 * Called by cron every 12 hours.
 */
export const syncAllMetrics = internalAction({
  args: {},
  handler: async (ctx) => {
    // Fetch all active Stripe connections
    const connections = await ctx.runQuery(internal.metrics.getAllActiveStripeConnections)

    // Sync Stripe metrics for each connection
    for (const connection of connections) {
      try {
        await ctx.runAction(internal.metrics.fetchStripeMetrics, {
          startupId: connection.startupId,
        })
        await ctx.runMutation(internal.metrics.updateConnectionSyncStatus, {
          connectionId: connection._id,
          lastSyncedAt: new Date().toISOString(),
        })
      } catch (error) {
        logConvexError(`Error syncing Stripe for startup ${connection.startupId}:`, error)
        await ctx.runMutation(internal.metrics.updateConnectionSyncStatus, {
          connectionId: connection._id,
          status: 'error',
          syncError: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Fetch all startups with tracker websites
    const startupIds = await ctx.runQuery(internal.metrics.getStartupsWithTrackers)

    // Sync tracker metrics for each startup
    for (const startupId of startupIds) {
      try {
        await ctx.runAction(internal.metrics.fetchTrackerMetrics_cron, {
          startupId,
        })
      } catch (error) {
        logConvexError(`Error syncing tracker metrics for startup ${startupId}:`, error)
      }
    }
  },
})

/**
 * Fetch and store tracker metrics for a startup (used by cron).
 * Aggregates tracker events into metric snapshots.
 */
export const fetchTrackerMetrics_cron = internalAction({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    // Get tracker websites for this startup
    const websites: any[] = await ctx.runQuery(internal.metrics.getTrackerWebsitesForStartup, {
      startupId: args.startupId,
    })

    if (websites.length === 0) return

    const websiteIds = websites.map((w: any) => w._id)

    // Get tracker events for these websites (last 30 days)
    const events: any[] = await ctx.runQuery(internal.metrics.getTrackerEventsForWebsites, {
      websiteIds,
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    })

    // Aggregate events into daily buckets
    const buckets = new Map<string, { pageviews: number; sessions: Set<string> }>()

    for (const event of events) {
      const date = new Date(event._creationTime)
      const bucket = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

      if (!buckets.has(bucket)) {
        buckets.set(bucket, { pageviews: 0, sessions: new Set() })
      }

      const b = buckets.get(bucket)!
      if (!event.eventName) {
        b.pageviews++
      }
      if (event.sessionId) {
        b.sessions.add(event.sessionId)
      }
    }

    // Store aggregated metrics
    const snapshots: Array<{
      startupId: typeof args.startupId
      provider: 'tracker'
      metricKey: string
      value: number
      timestamp: string
      window: 'daily'
    }> = []

    for (const [bucket, data] of buckets) {
      const timestamp = `${bucket}T00:00:00.000Z`

      snapshots.push({
        startupId: args.startupId,
        provider: 'tracker',
        metricKey: 'pageviews',
        value: data.pageviews,
        timestamp,
        window: 'daily',
      })

      snapshots.push({
        startupId: args.startupId,
        provider: 'tracker',
        metricKey: 'sessions',
        value: data.sessions.size,
        timestamp,
        window: 'daily',
      })

      snapshots.push({
        startupId: args.startupId,
        provider: 'tracker',
        metricKey: 'weekly_active_users',
        value: data.sessions.size,
        timestamp,
        window: 'daily',
      })
    }

    if (snapshots.length > 0) {
      await ctx.runMutation(internal.metrics.storeInternal, { snapshots })
    }
  },
})

/**
 * Get tracker websites for a startup (internal).
 */
export const getTrackerWebsitesForStartup = internalQuery({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('trackerWebsites')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()
  },
})

/**
 * Get tracker events for websites since a given date (internal).
 */
export const getTrackerEventsForWebsites = internalQuery({
  args: {
    websiteIds: v.array(v.id('trackerWebsites')),
    since: v.string(),
  },
  handler: async (ctx, args) => {
    const sinceTime = new Date(args.since).getTime()
    const allEvents = []

    for (const websiteId of args.websiteIds) {
      const events = await ctx.db
        .query('trackerEvents')
        .withIndex('by_websiteId', (q) => q.eq('websiteId', websiteId))
        .collect()

      // Filter by creation time
      const filtered = events.filter((e) => e._creationTime >= sinceTime)
      allEvents.push(...filtered)
    }

    return allEvents
  },
})

// ── One-time cleanup ─────────────────────────────────────────────────

/**
 * Get all metricsData rows (internal, for cleanup).
 */
export const getAllMetricsData = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('metricsData').collect()
  },
})

/**
 * Delete specific metricsData rows by ID (internal, for cleanup).
 */
export const deleteMetricsRows = internalMutation({
  args: { ids: v.array(v.id('metricsData')) },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.delete(id)
    }
  },
})

/**
 * One-time cleanup: remove duplicate metric snapshots.
 * Groups by (startupId, provider, metricKey, day), keeps latest per group.
 * Run from the Convex dashboard after deploy.
 */
export const cleanupDuplicateSnapshots = internalAction({
  args: {},
  handler: async (ctx) => {
    const allRows: any[] = await ctx.runQuery(internal.metrics.getAllMetricsData)

    // Group by (startupId, provider, metricKey, day)
    const groups = new Map<string, Array<{ _id: any; timestamp: string }>>()
    for (const row of allRows) {
      const day = row.timestamp.slice(0, 10)
      const key = `${row.startupId}|${row.provider}|${row.metricKey}|${day}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push({ _id: row._id, timestamp: row.timestamp })
    }

    // Find IDs to delete (all but latest per group)
    const toDelete: any[] = []
    for (const rows of groups.values()) {
      if (rows.length <= 1) continue
      rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      // Keep first (latest), delete rest
      for (let i = 1; i < rows.length; i++) {
        toDelete.push(rows[i]._id)
      }
    }

    if (toDelete.length === 0) return

    // Delete in batches (Convex mutations have limits)
    const batchSize = 500
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize)
      await ctx.runMutation(internal.metrics.deleteMetricsRows, { ids: batch })
    }
  },
})
