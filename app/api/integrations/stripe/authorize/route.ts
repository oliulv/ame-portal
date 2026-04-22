import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { signState } from '@/lib/oauthState'

/**
 * GET /api/integrations/stripe/authorize
 *
 * Starts the Stripe Connect OAuth flow with a signed CSRF `state` parameter
 * that carries both the Clerk userId and the target startupId. The callback
 * verifies this state — a tampered or cross-user state is rejected.
 *
 * Query params:
 *   ?startupId=<id>  Optional. For multi-startup founders. If omitted, the
 *                    founder's sole startup is resolved server-side.
 */
export async function GET(request: Request) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')

  const { userId, getToken } = await auth()
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/founder/settings?error=not_authenticated`)
  }

  const clientId = process.env.STRIPE_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/founder/settings?error=stripe_not_configured`)
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  const token = await getToken({ template: 'convex' })
  if (token) convex.setAuth(token)

  const requested = new URL(request.url).searchParams.get('startupId')
  const startupId = requested ?? (await convex.query(api.integrations.getFounderStartupId))
  if (!startupId) {
    return NextResponse.redirect(`${appUrl}/founder/settings?error=no_startup`)
  }

  const state = signState({ u: userId, s: String(startupId) })
  const redirectUri = `${appUrl}/api/integrations/stripe/callback`
  const url =
    `https://connect.stripe.com/oauth/authorize` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&scope=read_write` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`

  return NextResponse.redirect(url)
}
