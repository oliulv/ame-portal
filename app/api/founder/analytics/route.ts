import { NextResponse } from 'next/server'
import { requireFounder, getFounderStartupIds } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMetricTimeSeries } from '@/lib/integrations/metrics'
import { subDays } from 'date-fns'

/**
 * GET /api/founder/analytics
 * Get analytics data for the founder's startup
 */
export async function GET(request: Request) {
  try {
    // Authenticate and authorize
    await requireFounder()

    // Get founder's startup IDs
    const startupIds = await getFounderStartupIds()

    if (startupIds.length === 0) {
      return NextResponse.json({
        stripe: null,
      })
    }

    // Use the first startup
    const startupId = startupIds[0]

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '30' // days
    const rangeDays = parseInt(range, 10)

    const endDate = new Date()
    const startDate = subDays(endDate, rangeDays)

    const supabase = await createClient()

    // Check which integrations are connected
    const { data: connections } = await supabase
      .from('integration_connections')
      .select('provider, account_id')
      .eq('startup_id', startupId)
      .eq('is_active', true)
      .eq('status', 'active')

    const adminSupabase = createAdminClient()
    const { data: trackerWebsites } = await adminSupabase
      .from('tracker_websites')
      .select('id')
      .eq('startup_id', startupId)
      .limit(1)

    const stripeConnected = connections?.some((c) => c.provider === 'stripe')
    const trackerConnected = trackerWebsites && trackerWebsites.length > 0

    const result: {
      stripe: {
        revenue?: Array<{ timestamp: string; value: number }>
        customers?: Array<{ timestamp: string; value: number }>
        mrr?: Array<{ timestamp: string; value: number }>
      } | null
      tracker: {
        sessions?: Array<{ timestamp: string; value: number }>
        users?: Array<{ timestamp: string; value: number }>
        pageviews?: Array<{ timestamp: string; value: number }>
      } | null
    } = {
      stripe: null,
      tracker: null,
    }

    // Fetch Stripe metrics if connected
    if (stripeConnected) {
      const revenue = await getMetricTimeSeries(
        startupId,
        'stripe',
        'total_revenue',
        'daily',
        startDate,
        endDate
      )
      const customers = await getMetricTimeSeries(
        startupId,
        'stripe',
        'active_customers',
        'daily',
        startDate,
        endDate
      )
      const mrr = await getMetricTimeSeries(startupId, 'stripe', 'mrr', 'daily', startDate, endDate)

      result.stripe = {
        revenue: revenue.length > 0 ? revenue : undefined,
        customers: customers.length > 0 ? customers : undefined,
        mrr: mrr.length > 0 ? mrr : undefined,
      }
    }

    // Fetch Tracker metrics if connected
    if (trackerConnected) {
      const sessions = await getMetricTimeSeries(
        startupId,
        'tracker',
        'sessions',
        'daily',
        startDate,
        endDate
      )
      const users = await getMetricTimeSeries(
        startupId,
        'tracker',
        'weekly_active_users',
        'daily',
        startDate,
        endDate
      )
      const pageviews = await getMetricTimeSeries(
        startupId,
        'tracker',
        'pageviews',
        'daily',
        startDate,
        endDate
      )

      result.tracker = {
        sessions: sessions.length > 0 ? sessions : undefined,
        users: users.length > 0 ? users : undefined,
        pageviews: pageviews.length > 0 ? pageviews : undefined,
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching founder analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
