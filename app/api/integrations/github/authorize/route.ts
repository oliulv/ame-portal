import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/integrations/github/authorize
 *
 * Redirects to GitHub App's OAuth user-authorization endpoint. This ALWAYS
 * issues a `code` to our callback regardless of whether the App is already
 * installed, so reconnecting users always get a fresh user-to-server token.
 *
 * For private-repo access the founder ALSO needs to install the App — that
 * is a separate flow at `/api/integrations/github/install` (surfaced via
 * the restricted-contributions banner).
 *
 * CSRF: currently unprotected beyond what Clerk auth gives us in the
 * callback. The earlier cookie-based state verification was silently
 * failing in Next.js App Router Route Handlers, producing `invalid_state`
 * on every attempt. Follow-up (TODO): signed state parameter (HMAC over
 * userId + timestamp) carried in the URL, verified without a cookie.
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

  const redirectUri = `${appUrl}/api/integrations/github/callback`
  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`

  return NextResponse.redirect(url)
}
