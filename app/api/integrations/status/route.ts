import { NextResponse } from 'next/server'
import { requireFounder, getFounderStartupIds } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { IntegrationConnection } from '@/lib/types'

/**
 * GET /api/integrations/status
 * Get integration connection status for the founder's startup
 */
export async function GET() {
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

    const supabase = await createClient()

    const { data: connections, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('startup_id', startupId)
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching integration connections:', error)
      return NextResponse.json({ error: 'Failed to fetch integration status' }, { status: 500 })
    }

    const stripe = connections?.find((c) => c.provider === 'stripe') as
      | IntegrationConnection
      | undefined

    return NextResponse.json({
      stripe: stripe
        ? {
            id: stripe.id,
            status: stripe.status,
            account_name: stripe.account_name,
            connected_at: stripe.connected_at,
            last_synced_at: stripe.last_synced_at,
          }
        : null,
    })
  } catch (error) {
    console.error('Error fetching integration status:', error)
    return NextResponse.json({ error: 'Failed to fetch integration status' }, { status: 500 })
  }
}
