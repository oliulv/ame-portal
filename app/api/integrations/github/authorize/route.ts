import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/integrations/github/authorize
 * Redirects to GitHub OAuth.
 *
 * IMPORTANT: You must add your callback URL to the GitHub App settings:
 * Settings → Developer settings → GitHub Apps → Your App → "Callback URL"
 * Add: http://localhost:3000/api/integrations/github/callback (dev)
 * Add: https://yourdomain.com/api/integrations/github/callback (prod)
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

  // Note: redirect_uri must be registered in your GitHub App settings.
  // If using the same GitHub App as Clerk, add this callback URL alongside Clerk's.
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/github/callback`
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=read:user&redirect_uri=${encodeURIComponent(redirectUri)}`

  return NextResponse.redirect(url)
}
