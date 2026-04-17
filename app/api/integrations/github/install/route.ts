import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/integrations/github/install
 *
 * Redirects the founder to the GitHub App install page. If they haven't
 * installed the App yet, GitHub prompts them to pick which repos to grant
 * access. If they have, GitHub takes them to the configuration page where
 * they can adjust repo access. Either way, after the user saves, GitHub
 * redirects back to this app.
 *
 * This is the "upgrade your repo access" flow. For connecting a GitHub
 * account (OAuth), use `/api/integrations/github/authorize` instead.
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

  const url = `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`
  return NextResponse.redirect(url)
}
