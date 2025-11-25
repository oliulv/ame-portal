import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { MetricSnapshot } from '@/lib/types'

/**
 * Initialize Stripe client with access token from integration connection
 */
export async function getStripeClient(startupId: string): Promise<Stripe | null> {
  const supabase = createAdminClient()

  const { data: connection, error } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('startup_id', startupId)
    .eq('provider', 'stripe')
    .eq('is_active', true)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !connection || !connection.access_token) {
    return null
  }

  // Check if token is expired and refresh if needed
  if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
    // Token expired - would need to refresh, but Stripe Connect tokens typically don't expire
    // For now, return null to indicate connection needs re-authentication
    return null
  }

  return new Stripe(connection.access_token, {
    apiVersion: '2024-11-20.acacia',
  })
}

/**
 * Fetch Stripe metrics for a startup
 */
export async function fetchStripeMetrics(
  startupId: string,
  window: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<MetricSnapshot[]> {
  const stripe = await getStripeClient(startupId)

  if (!stripe) {
    throw new Error('Stripe connection not found or inactive')
  }

  const snapshots: MetricSnapshot[] = []
  const now = new Date()

  // Calculate time range based on window
  let startDate: Date
  switch (window) {
    case 'daily':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      break
    case 'weekly':
      startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000) // Last 12 weeks
      break
    case 'monthly':
      startDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000) // Last 12 months
      break
  }

  const startTimestamp = Math.floor(startDate.getTime() / 1000)

  try {
    // Fetch charges for revenue calculation
    const charges = await stripe.charges.list({
      created: { gte: startTimestamp },
      limit: 100,
    })

    // Calculate total revenue (sum of successful charges)
    const totalRevenue =
      charges.data
        .filter((c) => c.status === 'succeeded')
        .reduce((sum, c) => sum + (c.amount || 0), 0) / 100 // Convert cents to currency units

    // Count unique customers
    const uniqueCustomers = new Set(
      charges.data
        .map((c) => c.customer)
        .filter((customer): customer is string => Boolean(customer))
    ).size

    // Calculate MRR (Monthly Recurring Revenue) from subscriptions
    let mrr = 0
    const subscriptions = await stripe.subscriptions.list({
      created: { gte: startTimestamp },
      limit: 100,
      status: 'active',
    })

    for (const sub of subscriptions.data) {
      if (sub.items.data.length > 0) {
        const price = sub.items.data[0].price
        if (price?.recurring?.interval === 'month') {
          mrr += (price.unit_amount || 0) / 100
        } else if (price?.recurring?.interval === 'year') {
          mrr += (price.unit_amount || 0) / 100 / 12
        }
      }
    }

    // Create metric snapshots
    snapshots.push({
      startup_id: startupId,
      provider: 'stripe',
      metric_key: 'total_revenue',
      value: totalRevenue,
      timestamp: now,
      window,
      meta: { charge_count: charges.data.length },
    })

    snapshots.push({
      startup_id: startupId,
      provider: 'stripe',
      metric_key: 'active_customers',
      value: uniqueCustomers,
      timestamp: now,
      window,
      meta: { subscription_count: subscriptions.data.length },
    })

    snapshots.push({
      startup_id: startupId,
      provider: 'stripe',
      metric_key: 'mrr',
      value: mrr,
      timestamp: now,
      window,
      meta: { subscription_count: subscriptions.data.length },
    })
  } catch (error) {
    console.error('Error fetching Stripe metrics:', error)
    throw error
  }

  return snapshots
}

/**
 * Store Stripe connection after OAuth callback
 */
export async function storeStripeConnection(
  startupId: string,
  accessToken: string,
  accountId: string,
  accountName?: string,
  connectedByUserId?: string
): Promise<void> {
  const supabase = createAdminClient()

  // Upsert connection
  const { error } = await supabase.from('integration_connections').upsert(
    {
      startup_id: startupId,
      provider: 'stripe',
      account_id: accountId,
      account_name: accountName,
      access_token: accessToken,
      status: 'active',
      is_active: true,
      connected_by_user_id: connectedByUserId,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'startup_id,provider',
    }
  )

  if (error) {
    console.error('Error storing Stripe connection:', error)
    throw new Error('Failed to store Stripe connection')
  }
}

/**
 * Disconnect Stripe integration
 */
export async function disconnectStripe(startupId: string): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('integration_connections')
    .update({
      status: 'disconnected',
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('startup_id', startupId)
    .eq('provider', 'stripe')

  if (error) {
    console.error('Error disconnecting Stripe:', error)
    throw new Error('Failed to disconnect Stripe')
  }
}
