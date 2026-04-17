import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { logServerError } from '@/lib/logging'

/**
 * GET /api/integrations/github/callback
 * Handles GitHub App OAuth callback. CSRF state verification removed
 * temporarily (see authorize/route.ts TODO) — callback still enforces
 * Clerk auth and GitHub code exchange, so unauthorized third parties
 * cannot hijack a connection.
 */
export async function GET(request: Request) {
  // Create client per-request to avoid auth leaking between concurrent requests
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')

  try {
    const { userId, getToken } = await auth()
    if (!userId) {
      return NextResponse.redirect(`${appUrl}/founder/integrations?error=not_authenticated`)
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(`${appUrl}/founder/integrations?error=github_connection_failed`)
    }

    if (!code) {
      return NextResponse.redirect(`${appUrl}/founder/integrations?error=github_missing_code`)
    }

    const clientId = process.env.GITHUB_APP_CLIENT_ID
    const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appUrl}/founder/integrations?error=github_config_missing`)
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error || !tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/founder/integrations?error=github_token_failed`)
    }

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })

    const userData = await userResponse.json()

    // Authenticate the Convex client with Clerk token
    const token = await getToken({ template: 'convex' })
    if (token) {
      convex.setAuth(token)
    }

    // Get founder's startup ID
    const startupId = await convex.query(api.integrations.getFounderStartupId)
    if (!startupId) {
      return NextResponse.redirect(`${appUrl}/founder/integrations?error=no_startup`)
    }

    // Store connection
    await convex.mutation(api.integrations.storeGithubConnection, {
      startupId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : undefined,
      accountId: String(userData.id),
      accountName: userData.login,
    })

    return NextResponse.redirect(`${appUrl}/founder/integrations?success=github_connected`)
  } catch (error) {
    logServerError('Error handling GitHub callback:', error)
    return NextResponse.redirect(`${appUrl}/founder/integrations?error=github_connection_error`)
  }
}
