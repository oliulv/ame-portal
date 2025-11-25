import { NextResponse } from 'next/server'
import { requireFounder, getFounderStartupIds } from '@/lib/auth'
import { disconnectStripe } from '@/lib/integrations/stripe'

/**
 * POST /api/integrations/stripe/disconnect
 * Disconnects Stripe integration for the founder's startup
 */
export async function POST() {
  try {
    // Authenticate and authorize
    await requireFounder()

    // Get founder's startup IDs
    const startupIds = await getFounderStartupIds()

    if (startupIds.length === 0) {
      return NextResponse.json({ error: 'No startup found for this founder' }, { status: 404 })
    }

    // Use the first startup
    const startupId = startupIds[0]

    // Disconnect Stripe
    await disconnectStripe(startupId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting Stripe:', error)
    return NextResponse.json({ error: 'Failed to disconnect Stripe' }, { status: 500 })
  }
}
