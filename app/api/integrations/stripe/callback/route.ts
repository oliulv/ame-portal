import { NextResponse } from 'next/server'
import { requireFounder } from '@/lib/auth'
import { storeStripeConnection } from '@/lib/integrations/stripe'
import Stripe from 'stripe'

/**
 * GET /api/integrations/stripe/callback
 * Handles Stripe OAuth callback and stores connection
 */
export async function GET(request: Request) {
  try {
    // Authenticate user
    await requireFounder()

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // Contains startup_id
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/founder/settings?error=stripe_connection_failed`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/founder/settings?error=stripe_connection_invalid`
      )
    }

    const startupId = state
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/founder/settings?error=stripe_config_missing`
      )
    }

    // Exchange authorization code for access token
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    })

    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    })

    // Get account information
    const accountId = response.stripe_user_id || ''
    const accountName = response.stripe_publishable_key ? 'Connected Account' : undefined

    // Store connection in database
    await storeStripeConnection(startupId, response.access_token, accountId, accountName)

    // Redirect back to settings page with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/founder/settings?success=stripe_connected`
    )
  } catch (error) {
    console.error('Error handling Stripe callback:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/founder/settings?error=stripe_connection_error`
    )
  }
}
