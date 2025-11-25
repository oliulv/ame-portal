import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMetricTimeSeries } from '@/lib/integrations/metrics'
import { subDays } from 'date-fns'

interface RouteContext {
  params: Promise<{
    slug: string
  }>
}

/**
 * GET /api/admin/startups/[slug]/analytics
 * Get analytics data for a specific startup (admin view)
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    // Authenticate and authorize
    await requireAdmin()

    const { slug } = await context.params
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '30' // days
    const rangeDays = parseInt(range, 10)

    const endDate = new Date()
    const startDate = subDays(endDate, rangeDays)

    const supabase = await createClient()

    // Fetch startup by slug
    const { data: startup, error: startupError } = await supabase
      .from('startups')
      .select('id')
      .eq('slug', slug)
      .single()

    if (startupError || !startup) {
      return NextResponse.json({ error: 'Startup not found' }, { status: 404 })
    }

    // Check which integrations are connected
    const { data: connections } = await supabase
      .from('integration_connections')
      .select('provider, account_id')
      .eq('startup_id', startup.id)
      .eq('is_active', true)
      .eq('status', 'active')

    const adminSupabase = createAdminClient()
    const { data: trackerWebsites } = await adminSupabase
      .from('tracker_websites')
      .select('id')
      .eq('startup_id', startup.id)
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
        startup.id,
        'stripe',
        'total_revenue',
        'daily',
        startDate,
        endDate
      )
      const customers = await getMetricTimeSeries(
        startup.id,
        'stripe',
        'active_customers',
        'daily',
        startDate,
        endDate
      )
      const mrr = await getMetricTimeSeries(
        startup.id,
        'stripe',
        'mrr',
        'daily',
        startDate,
        endDate
      )

      result.stripe = {
        revenue: revenue.length > 0 ? revenue : undefined,
        customers: customers.length > 0 ? customers : undefined,
        mrr: mrr.length > 0 ? mrr : undefined,
      }
    }

    // Fetch Tracker metrics if connected
    if (trackerConnected) {
      const sessions = await getMetricTimeSeries(
        startup.id,
        'tracker',
        'sessions',
        'daily',
        startDate,
        endDate
      )
      const users = await getMetricTimeSeries(
        startup.id,
        'tracker',
        'weekly_active_users',
        'daily',
        startDate,
        endDate
      )
      const pageviews = await getMetricTimeSeries(
        startup.id,
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
    console.error('Error fetching admin analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
