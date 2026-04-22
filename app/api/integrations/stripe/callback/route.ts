import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import Stripe from 'stripe'
import { logServerError } from '@/lib/logging'
import { verifyState } from '@/lib/oauthState'

/**
 * GET /api/integrations/stripe/callback
 * Handles Stripe OAuth callback and stores connection via Convex mutation.
 * Verifies the signed CSRF `state` produced by the authorize route, rejecting
 * tampered, expired, or cross-user states. The `startupId` is taken from the
 * verified state — never from an unauthenticated URL param.
 */
export async function GET(request: Request) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')

  try {
    const { userId, getToken } = await auth()
    if (!userId) {
      return NextResponse.redirect(`${appUrl}/founder/settings?error=not_authenticated`)
    }

    // Per-request client to avoid auth leaking between concurrent requests.
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
    const convexToken = await getToken({ template: 'convex' })
    if (convexToken) convex.setAuth(convexToken)

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(`${appUrl}/founder/settings?error=stripe_connection_failed`)
    }

    if (!code) {
      return NextResponse.redirect(`${appUrl}/founder/settings?error=stripe_connection_invalid`)
    }

    const parsedState = verifyState<{ u: string; s: string }>(state)
    if (!parsedState || parsedState.u !== userId) {
      return NextResponse.redirect(`${appUrl}/founder/settings?error=stripe_invalid_state`)
    }
    const startupId = parsedState.s as Id<'startups'>

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      return NextResponse.redirect(`${appUrl}/founder/settings?error=stripe_config_missing`)
    }

    // Exchange authorization code for access token
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-11-17.clover',
    })

    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    })

    const accountId = response.stripe_user_id || ''
    const accountName = response.stripe_publishable_key ? 'Connected Account' : undefined
    const accessToken = response.access_token

    if (!accessToken) {
      return NextResponse.redirect(`${appUrl}/founder/settings?error=stripe_token_missing`)
    }

    await convex.mutation(api.integrations.storeStripeConnection, {
      startupId,
      accessToken,
      accountId,
      accountName,
    })

    return NextResponse.redirect(`${appUrl}/founder/settings?success=stripe_connected`)
  } catch (error) {
    logServerError('Error handling Stripe callback:', error)
    return NextResponse.redirect(`${appUrl}/founder/settings?error=stripe_connection_error`)
  }
}
