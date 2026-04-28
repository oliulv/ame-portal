import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { signState } from '@/lib/oauthState'

/**
 * GET /api/integrations/github/install
 *
 * Redirects the founder to the GitHub App install page. If they haven't
 * installed the App yet, GitHub prompts them to pick which repos to grant
 * access. If they have, GitHub takes them to the configuration page where
 * they can adjust repo access. Either way, after the user saves, GitHub
 * redirects back to this app.
 *
 * With "Request user authorization (OAuth) during installation" enabled on
 * the GitHub App, this is also the first-time connect flow. GitHub preserves
 * the state parameter and returns it to the OAuth callback with the code.
 */
export async function GET() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/founder/integrations?error=not_authenticated`)
  }

  const appSlug = process.env.GITHUB_APP_SLUG
  if (!appSlug) {
    return NextResponse.redirect(`${appUrl}/founder/integrations?error=github_not_configured`)
  }

  const state = signState({ u: userId })
  const url = new URL(`https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`)
  url.searchParams.set('state', state)

  return NextResponse.redirect(url.toString())
}
