import { NextResponse } from 'next/server'
import { requireFounder, getFounderStartupIds } from '@/lib/auth'
import { z } from 'zod'
import { storeStripeConnection } from '@/lib/integrations/stripe'
import Stripe from 'stripe'

const connectStripeSchema = z.object({
  api_key: z.string().min(1, 'API key is required'),
  account_id: z.string().optional(),
})

/**
 * GET /api/integrations/stripe/connect
 * Redirects to API key entry page
 */
export async function GET(_request: Request) {
  try {
    await requireFounder()
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/founder/integrations?tab=stripe`
    )
  } catch (error) {
    console.error('Error redirecting to Stripe connect:', error)
    return NextResponse.json({ error: 'Failed to redirect' }, { status: 500 })
  }
}

/**
 * POST /api/integrations/stripe/connect
 * Connect Stripe using API key
 */
export async function POST(request: Request) {
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

    // Parse and validate request body
    const body = await request.json()
    const validatedData = connectStripeSchema.parse(body)

    // Test the API key by making a simple request to Stripe
    try {
      const stripe = new Stripe(validatedData.api_key, {
        apiVersion: '2025-11-17.clover',
      })

      // Verify the API key works by fetching account info
      const account = await stripe.accounts.retrieve()
      const accountId = validatedData.account_id || account.id
      const accountName = account.business_profile?.name || account.email || 'Stripe Account'

      // Store connection
      await storeStripeConnection(startupId, validatedData.api_key, accountId, accountName)

      return NextResponse.json({ success: true })
    } catch (stripeError) {
      console.error('Stripe API error:', stripeError)
      return NextResponse.json(
        { error: 'Invalid Stripe API key. Please check your key and try again.' },
        { status: 400 }
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error connecting Stripe:', error)
    return NextResponse.json({ error: 'Failed to connect Stripe' }, { status: 500 })
  }
}
