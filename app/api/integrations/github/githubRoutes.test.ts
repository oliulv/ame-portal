import { afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { signState, verifyState } from '@/lib/oauthState'

type AuthResult = {
  userId: string | null
  getToken?: (args: { template: string }) => Promise<string | null>
}

let authResult: AuthResult = { userId: 'user_123' }
const convexCalls: Array<{ type: string; value?: unknown; args?: unknown }> = []
const originalFetch = globalThis.fetch

mock.module('@clerk/nextjs/server', () => ({
  auth: async () => authResult,
}))

class MockConvexHttpClient {
  constructor(url: string) {
    convexCalls.push({ type: 'client', value: url })
  }

  setAuth(token: string) {
    convexCalls.push({ type: 'setAuth', value: token })
  }

  async query() {
    convexCalls.push({ type: 'query' })
    return 'startup_123'
  }

  async mutation(_ref: unknown, args: unknown) {
    convexCalls.push({ type: 'mutation', args })
  }
}

mock.module('convex/browser', () => ({
  ConvexHttpClient: MockConvexHttpClient,
}))

mock.module('@/convex/_generated/api', () => ({
  api: {
    integrations: {
      getFounderStartupId: 'getFounderStartupId',
      storeGithubConnection: 'storeGithubConnection',
    },
  },
}))

describe('GitHub integration routes', () => {
  beforeAll(() => {
    process.env.OAUTH_STATE_SECRET = 'x'.repeat(48)
  })

  beforeEach(() => {
    authResult = {
      userId: 'user_123',
      getToken: async () => 'clerk-token',
    }
    convexCalls.length = 0
    process.env.NEXT_PUBLIC_APP_URL = 'https://acc.test'
    process.env.NEXT_PUBLIC_CONVEX_URL = 'https://convex.test'
    process.env.GITHUB_APP_SLUG = 'acc-os-tracking'
    process.env.GITHUB_APP_CLIENT_ID = 'client_123'
    process.env.GITHUB_APP_CLIENT_SECRET = 'secret_123'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('starts first-time GitHub connect from the App installation URL with signed state', async () => {
    const { GET } = await import('./install/route')

    const response = await GET()
    const location = response.headers.get('location')

    expect(response.status).toBe(307)
    expect(location).toStartWith('https://github.com/apps/acc-os-tracking/installations/new?')

    const state = new URL(location!).searchParams.get('state')
    expect(verifyState<{ u: string }>(state)?.u).toBe('user_123')
  })

  it('keeps unauthenticated installs inside the founder integrations flow', async () => {
    authResult = { userId: null }
    const { GET } = await import('./install/route')

    const response = await GET()

    expect(response.headers.get('location')).toBe(
      'https://acc.test/founder/integrations?error=not_authenticated'
    )
  })

  it('rejects callback requests whose signed state is not bound to the Clerk user', async () => {
    authResult = {
      userId: 'real_user',
      getToken: async () => 'clerk-token',
    }
    const { GET } = await import('./callback/route')
    const attackerState = signState({ u: 'attacker_user' })

    const response = await GET(
      new Request(
        `https://acc.test/api/integrations/github/callback?code=abc&state=${encodeURIComponent(attackerState)}`
      )
    )

    expect(response.headers.get('location')).toBe(
      'https://acc.test/founder/integrations?error=github_invalid_state'
    )
  })

  it('exchanges callback codes with the exact redirect_uri and stores the GitHub connection', async () => {
    const fetchCalls: Array<{ url: string; body?: string }> = []
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      fetchCalls.push({ url, body: init?.body as string | undefined })
      if (url.includes('/login/oauth/access_token')) {
        return Response.json({ access_token: 'ghu_token', expires_in: 28800 })
      }
      return Response.json({ id: 47, login: 'octocat' })
    }) as typeof fetch

    const { GET } = await import('./callback/route')
    const state = signState({ u: 'user_123' })

    const response = await GET(
      new Request(
        `https://acc.test/api/integrations/github/callback?code=abc&state=${encodeURIComponent(state)}`
      )
    )

    expect(response.headers.get('location')).toBe(
      'https://acc.test/founder/integrations?success=github_connected'
    )
    expect(JSON.parse(fetchCalls[0].body!)).toMatchObject({
      client_id: 'client_123',
      client_secret: 'secret_123',
      code: 'abc',
      redirect_uri: 'https://acc.test/api/integrations/github/callback',
    })
    expect(convexCalls).toContainEqual({ type: 'setAuth', value: 'clerk-token' })
    expect(convexCalls.find((call) => call.type === 'mutation')?.args).toMatchObject({
      startupId: 'startup_123',
      accessToken: 'ghu_token',
      accountId: '47',
      accountName: 'octocat',
    })
  })
})
