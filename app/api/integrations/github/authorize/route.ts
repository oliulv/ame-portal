import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'

/**
 * GET /api/integrations/github/authorize
 * Redirects to GitHub OAuth with CSRF state parameter.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/founder/integrations?error=not_authenticated`
    )
  }

  const clientId = process.env.GITHUB_APP_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/founder/integrations?error=github_not_configured`
    )
  }

  // Generate CSRF state token
  const state = crypto.randomUUID()
  const cookieStore = await cookies()
  cookieStore.set('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/api/integrations/github',
  })

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/github/callback`
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=read:user&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`

  return NextResponse.redirect(url)
}
