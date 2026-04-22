import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { signState } from '@/lib/oauthState'

/**
 * GET /api/integrations/github/authorize
 *
 * Redirects to GitHub App's OAuth user-authorization endpoint with a signed
 * CSRF `state` parameter scoped to the current Clerk user. The callback
 * verifies the state before exchanging the code — see ../callback/route.ts.
 */
export async function GET() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/founder/integrations?error=not_authenticated`)
  }

  const clientId = process.env.GITHUB_APP_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/founder/integrations?error=github_not_configured`)
  }

  const state = signState({ u: userId })
  const redirectUri = `${appUrl}/api/integrations/github/callback`
  const url =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`

  return NextResponse.redirect(url)
}
