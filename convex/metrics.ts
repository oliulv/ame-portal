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
import { providerValidator } from './lib/providers'

/**
 * Store metric snapshots (upserts by day to avoid duplicates).
 */
export const store = mutation({
  args: {
    snapshots: v.array(
      v.object({
        startupId: v.id('startups'),
        provider: providerValidator,
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
    provider: providerValidator,
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
    provider: providerValidator,
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
 * Triggers Stripe, tracker, and GitHub metric fetches.
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

    try {
      await ctx.runAction(internal.metrics.fetchGithubMetrics, {
        startupId: args.startupId,
      })
    } catch (error) {
      errors.push(`GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
 * Normalize a subscription item to monthly GBP pence.
 * Handles: month, year, week, day intervals with interval_count.
 * Applies coupon discounts (percent_off or amount_off with "forever" duration).
 */
function normalizeToMonthlyPence(
  unitAmount: number,
  quantity: number,
  interval: string,
  intervalCount: number,
  coupon?: { percent_off?: number | null; amount_off?: number | null; duration?: string | null }
): number {
  let monthlyAmount: number
  switch (interval) {
    case 'month':
      monthlyAmount = (unitAmount * quantity) / intervalCount
      break
    case 'year':
      monthlyAmount = (unitAmount * quantity) / (12 * intervalCount)
      break
    case 'week':
      monthlyAmount = (unitAmount * quantity * (52 / 12)) / intervalCount
      break
    case 'day':
      monthlyAmount = (unitAmount * quantity * (365 / 12)) / intervalCount
      break
    default:
      monthlyAmount = unitAmount * quantity
  }

  // Apply "forever" coupon discounts only (temporary coupons are revenue timing, not MRR)
  if (coupon?.duration === 'forever') {
    if (coupon.percent_off) {
      monthlyAmount *= 1 - coupon.percent_off / 100
    } else if (coupon.amount_off) {
      // Normalize fixed-amount coupon to monthly if applied to non-monthly interval
      let monthlyCouponAmount = coupon.amount_off
      if (interval === 'year') monthlyCouponAmount = coupon.amount_off / 12
      monthlyAmount = Math.max(0, monthlyAmount - monthlyCouponAmount)
    }
  }

  return Math.round(monthlyAmount)
}

/**
 * Fetch and store Stripe metrics for a startup (action).
 * MRR from subscriptions (not charges). Revenue from invoices (not charges).
 */
export const fetchStripeMetrics = internalAction({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    const connection: any = await ctx.runQuery(internal.metrics.getStripeConnection, {
      startupId: args.startupId,
    })

    if (!connection?.accessToken) return

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(connection.accessToken, {
      apiVersion: '2025-11-17.clover',
    })

    const now = new Date()
    const timestamp = now.toISOString()

    // ── MRR from subscriptions ──────────────────────────────────────
    const activeSubs = await paginateStripe((p) =>
      stripe.subscriptions.list({ ...p, status: 'active' })
    )
    const pastDueSubs = await paginateStripe((p) =>
      stripe.subscriptions.list({ ...p, status: 'past_due' })
    )
    const allMrrSubs = [...activeSubs, ...pastDueSubs]

    let mrrPence = 0
    let activeSubscriptionCount = 0
    const customerMrrMap = new Map<string, number>()

    for (const sub of allMrrSubs) {
      // Skip trialing subs
      if (sub.trial_end && sub.trial_end * 1000 > now.getTime()) continue

      const customerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer as any)?.id

      let subMrr = 0
      for (const item of sub.items.data) {
        const price = item.price
        if (!price?.recurring) continue
        // Skip free plans
        if (!price.unit_amount || price.unit_amount === 0) continue
        // Skip metered billing (usage-based, not predictable MRR)
        if (price.recurring.usage_type === 'metered') continue

        const firstDiscount = Array.isArray(sub.discounts) ? sub.discounts[0] : undefined
        const discountObj =
          firstDiscount && typeof firstDiscount === 'object' ? (firstDiscount as any) : undefined
        const coupon = discountObj?.coupon
          ? {
              percent_off: discountObj.coupon.percent_off as number | null,
              amount_off: discountObj.coupon.amount_off as number | null,
              duration: discountObj.coupon.duration as string | null,
            }
          : undefined

        subMrr += normalizeToMonthlyPence(
          price.unit_amount,
          item.quantity ?? 1,
          price.recurring.interval,
          price.recurring.interval_count ?? 1,
          coupon
        )
      }

      if (subMrr > 0) {
        activeSubscriptionCount++
        mrrPence += subMrr
        if (customerId) {
          customerMrrMap.set(customerId, (customerMrrMap.get(customerId) ?? 0) + subMrr)
        }
      }
    }

    const mrr = mrrPence / 100 // Convert pence to pounds
    const arr = mrr * 12
    const arpu = activeSubscriptionCount > 0 ? mrr / activeSubscriptionCount : 0

    // ── Revenue from paid invoices ──────────────────────────────────
    const paidInvoices = await paginateStripe((p) => stripe.invoices.list({ ...p, status: 'paid' }))
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.amount_paid ?? 0), 0) / 100

    // Active customers: unique customers from paid invoices in last 90 days
    const ninetyDaysAgo = Math.floor((now.getTime() - 90 * 24 * 60 * 60 * 1000) / 1000)
    const recentInvoices = paidInvoices.filter(
      (inv) => inv.status_transitions?.paid_at && inv.status_transitions.paid_at >= ninetyDaysAgo
    )
    const uniqueCustomers = new Set(
      recentInvoices
        .map((inv) => (typeof inv.customer === 'string' ? inv.customer : null))
        .filter((c): c is string => Boolean(c))
    ).size

    // ── Store customerMrr time-series ───────────────────────────────
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    for (const [customerId, mrrValue] of customerMrrMap) {
      await ctx.runMutation(internal.metrics.upsertCustomerMrr, {
        startupId: args.startupId,
        stripeCustomerId: customerId,
        month: currentMonth,
        mrr: mrrValue,
      })
    }

    // ── Compute MRR movements by diffing with previous month ────────
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    const prevCustomerMrrs: any[] = await ctx.runQuery(internal.metrics.getCustomerMrrForMonth, {
      startupId: args.startupId,
      month: prevMonth,
    })

    const prevMrrMap = new Map<string, number>()
    for (const row of prevCustomerMrrs) {
      prevMrrMap.set(row.stripeCustomerId, row.mrr)
    }

    // Detect all customers across both months
    const allCustomers = new Set([...customerMrrMap.keys(), ...prevMrrMap.keys()])
    const movements: Array<{
      type: 'new' | 'expansion' | 'contraction' | 'churn' | 'reactivation'
      amount: number
      stripeCustomerId: string
    }> = []

    // We need to check historical churn to detect reactivations
    const allTimeCustomers: any[] = await ctx.runQuery(internal.metrics.getDistinctCustomerIds, {
      startupId: args.startupId,
    })
    const allTimeCustomerSet = new Set(allTimeCustomers.map((c: any) => c.stripeCustomerId))

    for (const customerId of allCustomers) {
      const currentMrr = customerMrrMap.get(customerId) ?? 0
      const previousMrr = prevMrrMap.get(customerId) ?? 0

      if (currentMrr > 0 && previousMrr === 0) {
        // Was this customer ever seen before?
        if (allTimeCustomerSet.has(customerId) && prevMrrMap.size > 0) {
          movements.push({ type: 'reactivation', amount: currentMrr, stripeCustomerId: customerId })
        } else {
          movements.push({ type: 'new', amount: currentMrr, stripeCustomerId: customerId })
        }
      } else if (currentMrr === 0 && previousMrr > 0) {
        movements.push({ type: 'churn', amount: previousMrr, stripeCustomerId: customerId })
      } else if (currentMrr > previousMrr) {
        movements.push({
          type: 'expansion',
          amount: currentMrr - previousMrr,
          stripeCustomerId: customerId,
        })
      } else if (currentMrr < previousMrr && currentMrr > 0) {
        movements.push({
          type: 'contraction',
          amount: previousMrr - currentMrr,
          stripeCustomerId: customerId,
        })
      }
    }

    // Store movements
    for (const movement of movements) {
      await ctx.runMutation(internal.metrics.insertMrrMovement, {
        startupId: args.startupId,
        month: currentMonth,
        type: movement.type,
        amount: movement.amount,
        stripeCustomerId: movement.stripeCustomerId,
      })
    }

    // ── Derived metrics ─────────────────────────────────────────────
    // Trial conversion rate
    const trialingSubs = await paginateStripe((p) =>
      stripe.subscriptions.list({ ...p, status: 'trialing' })
    )
    const totalTrialing = trialingSubs.length
    const totalActive = activeSubscriptionCount
    const trialConversionRate =
      totalTrialing + totalActive > 0 ? (totalActive / (totalTrialing + totalActive)) * 100 : 0

    // Payment failure rate (from recent invoices)
    const recentAllInvoices = await paginateStripe((p) =>
      stripe.invoices.list({
        ...p,
        created: { gte: ninetyDaysAgo },
      })
    )
    const failedPayments = recentAllInvoices.filter((inv) => inv.status === 'uncollectible').length
    const paymentFailureRate =
      recentAllInvoices.length > 0 ? (failedPayments / recentAllInvoices.length) * 100 : 0

    // Monthly churn rate
    const churnAmount = movements
      .filter((m) => m.type === 'churn')
      .reduce((sum, m) => sum + m.amount, 0)
    const prevTotalMrr = Array.from(prevMrrMap.values()).reduce((sum, v) => sum + v, 0)
    const monthlyChurnRate = prevTotalMrr > 0 ? (churnAmount / prevTotalMrr) * 100 : 0

    // Net Revenue Retention
    const nrr = prevTotalMrr > 0 ? (mrrPence / prevTotalMrr) * 100 : 100

    // LTV (ARPU / monthly churn rate)
    const ltv = monthlyChurnRate > 0 ? arpu / (monthlyChurnRate / 100) : 0

    // ── Store all metric snapshots ──────────────────────────────────
    await ctx.runMutation(internal.metrics.storeInternal, {
      snapshots: [
        {
          startupId: args.startupId,
          provider: 'stripe',
          metricKey: 'mrr',
          value: mrr,
          timestamp,
          window: 'daily',
        },
        {
          startupId: args.startupId,
          provider: 'stripe',
          metricKey: 'arr',
          value: arr,
          timestamp,
          window: 'daily',
        },
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
          metricKey: 'active_subscriptions',
          value: activeSubscriptionCount,
          timestamp,
          window: 'daily',
        },
        {
          startupId: args.startupId,
          provider: 'stripe',
          metricKey: 'arpu',
          value: arpu,
          timestamp,
          window: 'daily',
        },
        {
          startupId: args.startupId,
          provider: 'stripe',
          metricKey: 'nrr',
          value: nrr,
          timestamp,
          window: 'daily',
        },
        {
          startupId: args.startupId,
          provider: 'stripe',
          metricKey: 'ltv',
          value: ltv,
          timestamp,
          window: 'daily',
        },
        {
          startupId: args.startupId,
          provider: 'stripe',
          metricKey: 'trial_conversion_rate',
          value: trialConversionRate,
          timestamp,
          window: 'daily',
        },
        {
          startupId: args.startupId,
          provider: 'stripe',
          metricKey: 'payment_failure_rate',
          value: paymentFailureRate,
          timestamp,
          window: 'daily',
        },
        {
          startupId: args.startupId,
          provider: 'stripe',
          metricKey: 'monthly_churn_rate',
          value: monthlyChurnRate,
          timestamp,
          window: 'daily',
        },
      ],
    })

    // Update connection sync timestamp
    await ctx.runMutation(internal.metrics.updateConnectionSyncStatus, {
      connectionId: connection._id,
      lastSyncedAt: timestamp,
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
        provider: providerValidator,
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
 * Sync metrics from all active integrations (Stripe + Tracker + GitHub).
 * Called by cron every 12 hours. Fans out per-startup syncs as separate scheduled actions.
 */
export const syncAllMetrics = internalAction({
  args: {},
  handler: async (ctx) => {
    // Fan out Stripe syncs
    const connections = await ctx.runQuery(internal.metrics.getAllActiveStripeConnections)
    for (const connection of connections) {
      await ctx.scheduler.runAfter(0, internal.metrics.syncStripeForStartup, {
        startupId: connection.startupId,
        connectionId: connection._id,
      })
    }

    // Fan out tracker syncs
    const trackerStartupIds = await ctx.runQuery(internal.metrics.getStartupsWithTrackers)
    for (const startupId of trackerStartupIds) {
      await ctx.scheduler.runAfter(0, internal.metrics.syncTrackerForStartup, {
        startupId,
      })
    }

    // Fan out GitHub syncs
    const githubConnections = await ctx.runQuery(internal.metrics.getAllActiveGithubConnections)
    for (const connection of githubConnections) {
      await ctx.scheduler.runAfter(0, internal.metrics.syncGithubForStartup, {
        startupId: connection.startupId,
        connectionId: connection._id,
      })
    }
  },
})

/**
 * Sync Stripe metrics for a single startup (fan-out target).
 */
export const syncStripeForStartup = internalAction({
  args: { startupId: v.id('startups'), connectionId: v.id('integrationConnections') },
  handler: async (ctx, args) => {
    try {
      await ctx.runAction(internal.metrics.fetchStripeMetrics, {
        startupId: args.startupId,
      })
    } catch (error) {
      logConvexError(`Error syncing Stripe for startup ${args.startupId}:`, error)
      await ctx.runMutation(internal.metrics.updateConnectionSyncStatus, {
        connectionId: args.connectionId,
        status: 'error',
        syncError: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
})

/**
 * Sync tracker metrics for a single startup (fan-out target).
 */
export const syncTrackerForStartup = internalAction({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    try {
      await ctx.runAction(internal.metrics.fetchTrackerMetrics_cron, {
        startupId: args.startupId,
      })
    } catch (error) {
      logConvexError(`Error syncing tracker metrics for startup ${args.startupId}:`, error)
    }
  },
})

/**
 * Sync GitHub metrics for a single startup (fan-out target).
 */
export const syncGithubForStartup = internalAction({
  args: { startupId: v.id('startups'), connectionId: v.id('integrationConnections') },
  handler: async (ctx, args) => {
    try {
      await ctx.runAction(internal.metrics.fetchGithubMetrics, {
        startupId: args.startupId,
      })
      await ctx.runMutation(internal.metrics.updateConnectionSyncStatus, {
        connectionId: args.connectionId,
        lastSyncedAt: new Date().toISOString(),
      })
    } catch (error) {
      logConvexError(`Error syncing GitHub for startup ${args.startupId}:`, error)
      await ctx.runMutation(internal.metrics.updateConnectionSyncStatus, {
        connectionId: args.connectionId,
        status: 'error',
        syncError: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
})

/**
 * Get all active GitHub integration connections.
 */
export const getAllActiveGithubConnections = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('integrationConnections')
      .filter((q) =>
        q.and(
          q.eq(q.field('provider'), 'github'),
          q.eq(q.field('isActive'), true),
          q.eq(q.field('status'), 'active')
        )
      )
      .collect()
  },
})

/**
 * Fetch and store GitHub metrics for a startup.
 * Uses GraphQL contributionsCollection with Git Velocity scoring.
 */
export const fetchGithubMetrics = internalAction({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    const connection: any = await ctx.runQuery(internal.metrics.getGithubConnection, {
      startupId: args.startupId,
    })
    if (!connection?.accessToken) return

    const now = new Date()
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)

    const query = `query($from: DateTime!, $to: DateTime!) {
      viewer {
        contributionsCollection(from: $from, to: $to) {
          totalCommitContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          totalIssueContributions
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }`

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          from: fourWeeksAgo.toISOString(),
          to: now.toISOString(),
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const data = await response.json()
    const contrib = data.data?.viewer?.contributionsCollection
    if (!contrib) return

    const commits = contrib.totalCommitContributions ?? 0
    const prsOpened = contrib.totalPullRequestContributions ?? 0
    const reviews = contrib.totalPullRequestReviewContributions ?? 0
    const issues = contrib.totalIssueContributions ?? 0

    // Git Velocity scoring
    const velocityScore = commits * 10 + prsOpened * 25 + reviews * 30

    const timestamp = now.toISOString()

    // Store contribution calendar for heatmap
    const calendarData = contrib.contributionCalendar?.weeks ?? []

    await ctx.runMutation(internal.metrics.storeInternal, {
      snapshots: [
        {
          startupId: args.startupId,
          provider: 'github' as const,
          metricKey: 'velocity_score',
          value: velocityScore,
          timestamp,
          window: 'daily' as const,
        },
        {
          startupId: args.startupId,
          provider: 'github' as const,
          metricKey: 'commits',
          value: commits,
          timestamp,
          window: 'daily' as const,
        },
        {
          startupId: args.startupId,
          provider: 'github' as const,
          metricKey: 'prs_opened',
          value: prsOpened,
          timestamp,
          window: 'daily' as const,
        },
        {
          startupId: args.startupId,
          provider: 'github' as const,
          metricKey: 'reviews',
          value: reviews,
          timestamp,
          window: 'daily' as const,
        },
        {
          startupId: args.startupId,
          provider: 'github' as const,
          metricKey: 'total_contributions',
          value: commits + prsOpened + reviews + issues,
          timestamp,
          window: 'daily' as const,
        },
      ],
    })

    // Store calendar data as meta on a special metric
    await ctx.runMutation(internal.metrics.storeInternalWithMeta, {
      startupId: args.startupId,
      provider: 'github' as const,
      metricKey: 'contribution_calendar',
      value: 0,
      timestamp,
      window: 'daily' as const,
      meta: calendarData,
    })
  },
})

/**
 * Get GitHub connection for a startup.
 */
export const getGithubConnection = internalQuery({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId_provider', (q) =>
        q.eq('startupId', args.startupId).eq('provider', 'github')
      )
      .filter((q) => q.and(q.eq(q.field('isActive'), true), q.eq(q.field('status'), 'active')))
      .first()
  },
})

/**
 * Store a single metric with meta (used for contribution calendar data).
 */
export const storeInternalWithMeta = internalMutation({
  args: {
    startupId: v.id('startups'),
    provider: providerValidator,
    metricKey: v.string(),
    value: v.number(),
    timestamp: v.string(),
    window: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
    meta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const dayTs = args.timestamp.slice(0, 10) + 'T00:00:00.000Z'

    const existing = await ctx.db
      .query('metricsData')
      .withIndex('by_startupId_provider_metricKey', (q) =>
        q
          .eq('startupId', args.startupId)
          .eq('provider', args.provider)
          .eq('metricKey', args.metricKey)
      )
      .filter((q) => q.eq(q.field('timestamp'), dayTs))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value, meta: args.meta })
    } else {
      await ctx.db.insert('metricsData', { ...args, timestamp: dayTs })
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

// ── Customer MRR helpers ─────────────────────────────────────────────

/**
 * Upsert a customer's MRR for a given month.
 */
export const upsertCustomerMrr = internalMutation({
  args: {
    startupId: v.id('startups'),
    stripeCustomerId: v.string(),
    month: v.string(),
    mrr: v.number(),
    currencyOriginal: v.optional(v.string()),
    mrrOriginal: v.optional(v.number()),
    exchangeRate: v.optional(v.number()),
    subscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('customerMrr')
      .withIndex('by_startupId_customerId_month', (q) =>
        q
          .eq('startupId', args.startupId)
          .eq('stripeCustomerId', args.stripeCustomerId)
          .eq('month', args.month)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        mrr: args.mrr,
        currencyOriginal: args.currencyOriginal,
        mrrOriginal: args.mrrOriginal,
        exchangeRate: args.exchangeRate,
        subscriptionId: args.subscriptionId,
      })
    } else {
      await ctx.db.insert('customerMrr', {
        startupId: args.startupId,
        stripeCustomerId: args.stripeCustomerId,
        month: args.month,
        mrr: args.mrr,
        currencyOriginal: args.currencyOriginal,
        mrrOriginal: args.mrrOriginal,
        exchangeRate: args.exchangeRate,
        subscriptionId: args.subscriptionId,
      })
    }
  },
})

/**
 * Get customer MRR rows for a specific month.
 */
export const getCustomerMrrForMonth = internalQuery({
  args: {
    startupId: v.id('startups'),
    month: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('customerMrr')
      .withIndex('by_startupId_month', (q) =>
        q.eq('startupId', args.startupId).eq('month', args.month)
      )
      .collect()
  },
})

/**
 * Get distinct customer IDs that have ever had MRR for a startup.
 */
export const getDistinctCustomerIds = internalQuery({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('customerMrr')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()
    const seen = new Set<string>()
    return rows.filter((r) => {
      if (seen.has(r.stripeCustomerId)) return false
      seen.add(r.stripeCustomerId)
      return true
    })
  },
})

/**
 * Insert an MRR movement record.
 */
export const insertMrrMovement = internalMutation({
  args: {
    startupId: v.id('startups'),
    month: v.string(),
    type: v.union(
      v.literal('new'),
      v.literal('expansion'),
      v.literal('contraction'),
      v.literal('churn'),
      v.literal('reactivation')
    ),
    amount: v.number(),
    stripeCustomerId: v.string(),
    subscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('mrrMovements', {
      startupId: args.startupId,
      month: args.month,
      type: args.type,
      amount: args.amount,
      stripeCustomerId: args.stripeCustomerId,
      subscriptionId: args.subscriptionId,
    })
  },
})

/**
 * Get MRR movements for a startup and month (used by waterfall chart).
 */
export const getMrrMovements = query({
  args: {
    startupId: v.id('startups'),
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx)

    const q = ctx.db
      .query('mrrMovements')
      .withIndex('by_startupId', (qb) => qb.eq('startupId', args.startupId))

    const rows = await q.collect()

    if (args.month) {
      return rows.filter((r) => r.month === args.month)
    }
    return rows
  },
})

/**
 * Check if a Stripe webhook event has been processed (idempotency).
 */
export const getWebhookEvent = internalQuery({
  args: { stripeEventId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('stripeWebhookEvents')
      .withIndex('by_stripeEventId', (q) => q.eq('stripeEventId', args.stripeEventId))
      .first()
  },
})

/**
 * Record a processed Stripe webhook event.
 */
export const insertWebhookEvent = internalMutation({
  args: {
    stripeEventId: v.string(),
    type: v.string(),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('stripeWebhookEvents', {
      stripeEventId: args.stripeEventId,
      type: args.type,
      processedAt: new Date().toISOString(),
      payload: args.payload,
    })
  },
})

/**
 * Find the integration connection for a Stripe account ID (used by webhooks).
 */
export const getConnectionByStripeAccountId = internalQuery({
  args: { accountId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('integrationConnections')
      .filter((q) =>
        q.and(
          q.eq(q.field('provider'), 'stripe'),
          q.eq(q.field('accountId'), args.accountId),
          q.eq(q.field('isActive'), true)
        )
      )
      .first()
  },
})

/**
 * Backfill Stripe historical data when a founder first connects.
 * Reconstructs customerMrr time-series from invoice line items.
 */
export const backfillStripeHistory = internalAction({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    const connection: any = await ctx.runQuery(internal.metrics.getStripeConnection, {
      startupId: args.startupId,
    })
    if (!connection?.accessToken) return

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(connection.accessToken, {
      apiVersion: '2025-11-17.clover',
    })

    // Get all paid invoices and reconstruct monthly MRR per customer
    const allInvoices = await paginateStripe((p) => stripe.invoices.list({ ...p, status: 'paid' }))

    // Group by customer + month, sum recurring line items (exclude prorations)
    const monthlyMrr = new Map<string, Map<string, number>>() // customerId -> month -> mrr

    for (const invoice of allInvoices) {
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : null
      if (!customerId) continue

      const paidAt = invoice.status_transitions?.paid_at
      if (!paidAt) continue

      const date = new Date(paidAt * 1000)
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!monthlyMrr.has(customerId)) monthlyMrr.set(customerId, new Map())
      const customerMap = monthlyMrr.get(customerId)!

      for (const rawLine of invoice.lines?.data ?? []) {
        // Cast to any — Stripe API shape varies across versions
        const line = rawLine as any
        // Skip prorations
        if (line.proration) continue
        // Only recurring items
        if (!line.price?.recurring) continue
        if (!line.price.unit_amount || line.price.unit_amount === 0) continue

        const lineMrr = normalizeToMonthlyPence(
          line.price.unit_amount,
          line.quantity ?? 1,
          line.price.recurring.interval,
          line.price.recurring.interval_count ?? 1
        )

        customerMap.set(month, (customerMap.get(month) ?? 0) + lineMrr)
      }
    }

    // Store all historical customerMrr
    for (const [customerId, months] of monthlyMrr) {
      for (const [month, mrr] of months) {
        await ctx.runMutation(internal.metrics.upsertCustomerMrr, {
          startupId: args.startupId,
          stripeCustomerId: customerId,
          month,
          mrr,
        })
      }
    }

    // Compute MRR movements by diffing consecutive months
    const allMonths = new Set<string>()
    for (const months of monthlyMrr.values()) {
      for (const month of months.keys()) allMonths.add(month)
    }
    const sortedMonths = Array.from(allMonths).sort()

    const allCustomerIds = Array.from(monthlyMrr.keys())
    const seenCustomers = new Set<string>()

    for (let i = 0; i < sortedMonths.length; i++) {
      const month = sortedMonths[i]
      const prevMonth = i > 0 ? sortedMonths[i - 1] : null

      for (const customerId of allCustomerIds) {
        const currentMrr = monthlyMrr.get(customerId)?.get(month) ?? 0
        const previousMrr = prevMonth ? (monthlyMrr.get(customerId)?.get(prevMonth) ?? 0) : 0

        if (currentMrr > 0 && previousMrr === 0) {
          const type = seenCustomers.has(customerId) ? 'reactivation' : 'new'
          seenCustomers.add(customerId)
          await ctx.runMutation(internal.metrics.insertMrrMovement, {
            startupId: args.startupId,
            month,
            type,
            amount: currentMrr,
            stripeCustomerId: customerId,
          })
        } else if (currentMrr === 0 && previousMrr > 0) {
          await ctx.runMutation(internal.metrics.insertMrrMovement, {
            startupId: args.startupId,
            month,
            type: 'churn',
            amount: previousMrr,
            stripeCustomerId: customerId,
          })
        } else if (currentMrr > previousMrr) {
          seenCustomers.add(customerId)
          await ctx.runMutation(internal.metrics.insertMrrMovement, {
            startupId: args.startupId,
            month,
            type: 'expansion',
            amount: currentMrr - previousMrr,
            stripeCustomerId: customerId,
          })
        } else if (currentMrr < previousMrr && currentMrr > 0) {
          seenCustomers.add(customerId)
          await ctx.runMutation(internal.metrics.insertMrrMovement, {
            startupId: args.startupId,
            month,
            type: 'contraction',
            amount: previousMrr - currentMrr,
            stripeCustomerId: customerId,
          })
        } else if (currentMrr > 0) {
          seenCustomers.add(customerId)
        }
      }
    }
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
