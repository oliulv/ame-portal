import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchStripeMetrics } from '@/lib/integrations/stripe'
import { storeMetrics } from '@/lib/integrations/metrics'

/**
 * POST /api/cron/sync-metrics
 * Background job to sync metrics from all active integrations
 * Protected by CRON_SECRET header
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createAdminClient()

    // Fetch all active integration connections
    const { data: connections, error: connectionsError } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('is_active', true)
      .eq('status', 'active')

    if (connectionsError) {
      console.error('Error fetching integration connections:', connectionsError)
      return NextResponse.json(
        { error: 'Failed to fetch connections' },
        { status: 500 }
      )
    }

    // Fetch all startups with tracker websites
    const { data: trackerWebsites, error: trackerError } = await supabase
      .from('tracker_websites')
      .select('startup_id')
      .group('startup_id')

    if (trackerError) {
      console.error('Error fetching tracker websites:', trackerError)
    }

    const startupsWithTrackers = new Set(trackerWebsites?.map(tw => tw.startup_id) || [])

    if ((!connections || connections.length === 0) && startupsWithTrackers.size === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active connections or tracker websites to sync',
        synced: 0,
      })
    }

    let syncedCount = 0
    const errors: Array<{ startupId: string; provider: string; error: string }> = []

    // Sync metrics for each connection
    for (const connection of connections || []) {
      try {
        if (connection.provider === 'stripe') {
          // Fetch Stripe metrics for daily, weekly, and monthly windows
          const dailyMetrics = await fetchStripeMetrics(connection.startup_id, 'daily')
          const weeklyMetrics = await fetchStripeMetrics(connection.startup_id, 'weekly')
          const monthlyMetrics = await fetchStripeMetrics(connection.startup_id, 'monthly')

          // Store all metrics
          await storeMetrics([...dailyMetrics, ...weeklyMetrics, ...monthlyMetrics])
          syncedCount++

          // Update last_synced_at
          await supabase
            .from('integration_connections')
            .update({
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', connection.id)
        }
      } catch (error) {
        console.error(`Error syncing ${connection.provider} for startup ${connection.startup_id}:`, error)
        errors.push({
          startupId: connection.startup_id,
          provider: connection.provider,
          error: error instanceof Error ? error.message : 'Unknown error',
        })

        // Update connection status to error
        await supabase
          .from('integration_connections')
          .update({
            status: 'error',
            sync_error: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', connection.id)
      }
    }

    // Sync tracker metrics for startups with tracker websites
    for (const startupId of startupsWithTrackers) {
      try {
        const dailyMetrics = await fetchTrackerMetrics(startupId, 'daily')
        const weeklyMetrics = await fetchTrackerMetrics(startupId, 'weekly')
        const monthlyMetrics = await fetchTrackerMetrics(startupId, 'monthly')

        await storeMetrics([...dailyMetrics, ...weeklyMetrics, ...monthlyMetrics])
        syncedCount++
      } catch (error) {
        console.error(`Error syncing tracker metrics for startup ${startupId}:`, error)
        errors.push({
          startupId,
          provider: 'tracker',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      total: (connections?.length || 0) + startupsWithTrackers.size,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error in sync-metrics cron:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/sync-metrics
 * Allow manual triggering for testing (still requires auth)
 */
export async function GET(request: Request) {
  return POST(request)
}

