import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/integrations/github/authorize
 * Redirects to GitHub OAuth. Client ID stays server-side.
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

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/github/callback`
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=read:user&redirect_uri=${encodeURIComponent(redirectUri)}`

  return NextResponse.redirect(url)
}
