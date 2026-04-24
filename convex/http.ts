import { httpRouter } from 'convex/server'
import { httpAction } from './functions'
import { internal, components } from './_generated/api'
import { logConvexError, logConvexWarn } from './lib/logging'
import { RateLimiter, MINUTE, DAY } from '@convex-dev/rate-limiter'
import {
  truncateIp,
  deriveSessionId,
  deriveIpHash,
  utcDayKey,
  TrackerIdentError,
  SecretMissingError,
} from './lib/clientIdent'
import { hostnameMatchesTrackerDomain } from './lib/trackerDomain'
import { timingSafeEqual } from './lib/random'

const http = httpRouter()

// ── Rate limiter component (Convex first-party) ───────────────────────
//
// Two limits:
//   trackerEvent: events/min per (ipHash, websiteId). Token bucket so legit
//     bursts (e.g. someone clicking around fast) ride out.
//   trackerNewSession: distinct sessionIds an IP can mint per day per site.
//     Prevents UA-rotation from inflating the unique-session count that
//     drives the leaderboard's traffic category.
const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Per-IP per-website event ceiling. Token bucket so legit bursts ride out.
  trackerEvent: { kind: 'token bucket', rate: 60, period: MINUTE, capacity: 120 },
  // Per-IP global event ceiling. Defense-in-depth: stops a single IP from
  // multiplying its quota by spraying across many websiteIds.
  trackerEventGlobal: { kind: 'token bucket', rate: 240, period: MINUTE, capacity: 480 },
  // Per-IP per-website new-session ceiling. This must tolerate shared NATs
  // and offices, so keep it high enough for real daily users while still
  // bounding single-IP bot inflation far below the old unbounded behavior.
  trackerNewSession: { kind: 'fixed window', rate: 100, period: DAY },
})

// ── CORS headers for tracker ──────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-umami-cache',
  'Access-Control-Expose-Headers': 'x-umami-cache',
  'Access-Control-Max-Age': '86400',
}

// ── Tracker event collection ──────────────────────────────────────────
http.route({
  path: '/tracker/collect',
  method: 'OPTIONS',
  handler: httpAction(async () => {
    return new Response(null, { status: 200, headers: corsHeaders })
  }),
})

http.route({
  path: '/tracker/collect',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      // ── Fail-closed: required server secrets ──────────────────────
      const hashSecret = process.env.TRACKER_HASH_SECRET
      const proxySecret = process.env.TRACKER_PROXY_SECRET
      if (!hashSecret || !proxySecret) {
        logConvexError('Tracker collect: TRACKER_HASH_SECRET or TRACKER_PROXY_SECRET not set', null)
        return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── Proxy authentication ──────────────────────────────────────
      // The Convex .site URL is publicly reachable. Without this check, an
      // attacker could POST directly with any forged x-tracker-client-ip.
      // The Next.js proxy is the only thing that knows TRACKER_PROXY_SECRET,
      // so a missing/wrong header means "not from our proxy" → silent drop.
      const presentedSecret = request.headers.get('x-tracker-proxy-secret') ?? ''
      if (
        presentedSecret.length !== proxySecret.length ||
        !timingSafeEqual(presentedSecret, proxySecret)
      ) {
        logConvexWarn('Tracker collect: proxy secret mismatch')
        return silentSuccess(null)
      }

      // ── Required client headers (set by the Next.js proxy) ────────
      const clientIp = (request.headers.get('x-tracker-client-ip') ?? '').trim()
      const userAgent = request.headers.get('x-tracker-client-ua') ?? ''

      // ── Body ──────────────────────────────────────────────────────
      const body = await request.json()
      const { type, payload } = body
      if (!type || !payload || !payload.website) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const websiteIdStr = String(payload.website)

      // ── Derive identifiers ────────────────────────────────────────
      let ipTruncated: string
      try {
        if (!clientIp) throw new TrackerIdentError('missing x-tracker-client-ip')
        ipTruncated = truncateIp(clientIp)
      } catch (error) {
        // Preserve pageview/event ingestion if the proxy cannot provide a
        // usable IP. Sessions collapse into a site-specific degraded bucket,
        // so this remains hard to inflate while avoiding another zero-events
        // outage from one malformed header.
        logConvexWarn('Tracker collect: using degraded IP bucket', {
          websiteId: websiteIdStr,
          reason: error instanceof Error ? error.message : 'unknown',
        })
        ipTruncated = degradedIpBucket(websiteIdStr)
      }

      const dayUtc = utcDayKey()
      const sessionIdWithUa = await deriveSessionId({
        ipTruncated,
        userAgent,
        websiteId: websiteIdStr,
        dayUtc,
        secret: hashSecret,
      })
      const sessionIdFallback = await deriveSessionId({
        ipTruncated,
        userAgent: '',
        websiteId: websiteIdStr,
        dayUtc,
        secret: hashSecret,
      })
      const ipHash = await deriveIpHash({ ipTruncated, secret: hashSecret })

      // ── Insert via internal mutation (transactional rate-limit) ───
      await ctx.runMutation(internal.http.insertTrackerEvent, {
        websiteId: websiteIdStr,
        eventName: type === 'event' && payload.name ? payload.name : undefined,
        sessionIdWithUa,
        sessionIdFallback,
        ipHash,
        url: payload.url || '',
        referrer: payload.referrer || undefined,
        tag: payload.tag || undefined,
        screen: payload.screen || undefined,
        language: payload.language || undefined,
        title: payload.title || undefined,
        hostname: payload.hostname || undefined,
        data: payload.data || undefined,
        dayUtc,
      })

      // Echo a sessionId on the response for client cache parity. The
      // value is server-derived and changes if the user moves IP/UA — the
      // client treats it as opaque.
      return new Response(JSON.stringify({ success: true, sessionId: sessionIdWithUa }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'x-umami-cache': sessionIdWithUa,
        },
      })
    } catch (error) {
      if (error instanceof TrackerIdentError || error instanceof SecretMissingError) {
        logConvexError('Tracker collect: ident error', error)
        return new Response(JSON.stringify({ error: 'Bad request' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      logConvexError('Tracker collect error:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }),
})

/**
 * 200 OK with a stable success-shape, used for every silent-drop path
 * (proxy-secret mismatch, rate-limit overflow, domain mismatch). The
 * body and headers are byte-identical to a real success — attackers
 * can't distinguish accept from drop by inspecting the response.
 *
 * For paths where the real sessionId can't be safely echoed (proxy-secret
 * fail), we emit a fresh opaque token so the response shape doesn't
 * leak the failure mode.
 */
function silentSuccess(sessionId: string | null): Response {
  const echo = sessionId ?? randomOpaqueToken()
  return new Response(JSON.stringify({ success: true, sessionId: echo }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'x-umami-cache': echo,
    },
  })
}

function randomOpaqueToken(): string {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  let out = ''
  for (let i = 0; i < buf.length; i++) out += buf[i].toString(16).padStart(2, '0')
  return out
}

// ── Clerk webhook ─────────────────────────────────────────────────────
http.route({
  path: '/clerk/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      // Verify Svix signature to authenticate webhook origin
      const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
      if (!webhookSecret) {
        logConvexError('Clerk webhook error: CLERK_WEBHOOK_SECRET not set', null)
        return new Response('Server misconfigured', { status: 500 })
      }

      const payload = await request.text()
      const svixId = request.headers.get('svix-id')
      const svixTimestamp = request.headers.get('svix-timestamp')
      const svixSignature = request.headers.get('svix-signature')

      if (!svixId || !svixTimestamp || !svixSignature) {
        return new Response('Missing svix headers', { status: 400 })
      }

      const { Webhook } = await import('svix')
      const wh = new Webhook(webhookSecret)
      let body: any
      try {
        body = wh.verify(payload, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        }) as any
      } catch {
        return new Response('Invalid signature', { status: 401 })
      }

      const eventType = body.type

      if (eventType === 'user.deleted') {
        const clerkId = body.data?.id
        if (clerkId) {
          await ctx.runMutation(internal.http.deleteUserByClerkId, {
            clerkId,
          })
        }
      }

      // user.created: no auto-provision — users are created via invite flows

      return new Response('', { status: 200 })
    } catch (error) {
      logConvexError('Clerk webhook error:', error)
      return new Response('Internal server error', { status: 500 })
    }
  }),
})

export default http

// ── Internal mutations used by HTTP actions ───────────────────────────
import { internalMutation } from './functions'
import { v } from 'convex/values'
import { cascadeDeleteUserData } from './lib/userCleanup'

export const insertTrackerEvent = internalMutation({
  args: {
    websiteId: v.string(),
    eventName: v.optional(v.string()),
    sessionIdWithUa: v.string(),
    sessionIdFallback: v.string(),
    ipHash: v.string(),
    url: v.string(),
    referrer: v.optional(v.string()),
    tag: v.optional(v.string()),
    screen: v.optional(v.string()),
    language: v.optional(v.string()),
    title: v.optional(v.string()),
    hostname: v.optional(v.string()),
    data: v.optional(v.any()),
    dayUtc: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate website exists — websiteId comes from an external source as a string.
    const normalizedId = ctx.db.normalizeId('trackerWebsites', args.websiteId)
    if (!normalizedId) {
      logConvexWarn('Tracker collect: invalid website id', { websiteId: args.websiteId })
      return
    }
    const website = await ctx.db.get(normalizedId)
    if (!website) {
      logConvexWarn('Tracker collect: unknown website id', { websiteId: args.websiteId })
      return
    }

    // Domain enforcement — when the website is registered with a domain,
    // require the event's hostname to be present AND to match. Prevents
    // trivial cross-site forgery where an attacker copies another startup's
    // tracker id and either omits the hostname or supplies a wrong one.
    if (website.domain) {
      if (!hostnameMatchesTrackerDomain(args.hostname, website.domain)) {
        logConvexWarn('Tracker collect: domain mismatch', {
          websiteId: args.websiteId,
          hostname: args.hostname,
          domain: website.domain,
        })
        return
      }
    }

    // Event rate limits: silent drop on overflow. Attacker sees no signal.
    // Global cap first so an attacker can't dodge per-website limits by
    // spraying requests across many websiteIds.
    const globalLimit = await rateLimiter.limit(ctx, 'trackerEventGlobal', {
      key: args.ipHash,
    })
    if (!globalLimit.ok) {
      logConvexWarn('Tracker collect: global event rate limit exceeded', {
        websiteId: args.websiteId,
        ipHashPrefix: args.ipHash.slice(0, 12),
      })
      return
    }
    const evtKey = `${args.ipHash}:${args.websiteId}`
    const evtLimit = await rateLimiter.limit(ctx, 'trackerEvent', { key: evtKey })
    if (!evtLimit.ok) {
      logConvexWarn('Tracker collect: website event rate limit exceeded', {
        websiteId: args.websiteId,
        ipHashPrefix: args.ipHash.slice(0, 12),
      })
      return
    }

    // Pick which sessionId to record:
    //  - If the UA-keyed sessionId is already known for this site today,
    //    reuse it (this is the common case — a returning visitor's pageview).
    //  - If not, attempt to spend a new-session token. Token granted →
    //    record as a new unique session under the UA-keyed id.
    //  - Token denied → collapse onto the fallback sessionId (no UA in the
    //    hash). Defeats UA rotation: events still land but stop minting
    //    unique sessions.
    const startOfDayMs = utcDayStartMs(args.dayUtc)
    const existing = await ctx.db
      .query('trackerEvents')
      .withIndex('by_websiteId_sessionId', (q) =>
        q.eq('websiteId', normalizedId).eq('sessionId', args.sessionIdWithUa)
      )
      .filter((q) => q.gte(q.field('_creationTime'), startOfDayMs))
      .first()

    let finalSessionId: string
    if (existing) {
      finalSessionId = args.sessionIdWithUa
    } else {
      const nsKey = `${args.ipHash}:${args.websiteId}:${args.dayUtc}`
      const nsLimit = await rateLimiter.limit(ctx, 'trackerNewSession', { key: nsKey })
      if (!nsLimit.ok) {
        logConvexWarn('Tracker collect: new-session limit collapsed event', {
          websiteId: args.websiteId,
          ipHashPrefix: args.ipHash.slice(0, 12),
          dayUtc: args.dayUtc,
        })
      }
      finalSessionId = nsLimit.ok ? args.sessionIdWithUa : args.sessionIdFallback
    }

    const utmParams = extractUTMParams(args.url)

    await ctx.db.insert('trackerEvents', {
      websiteId: normalizedId,
      sessionId: finalSessionId,
      eventName: args.eventName,
      url: normalizeUrl(args.url),
      referrer: args.referrer ? normalizeUrl(args.referrer) : undefined,
      tag: args.tag,
      utmSource: utmParams.source,
      utmMedium: utmParams.medium,
      utmCampaign: utmParams.campaign,
      utmTerm: utmParams.term,
      utmContent: utmParams.content,
      screen: args.screen,
      language: args.language,
      title: args.title,
      hostname: args.hostname,
      data: args.data,
      sourceIpHash: args.ipHash,
    })

    await ctx.db.patch(normalizedId, { lastEventAt: new Date().toISOString() })
  },
})

export const deleteUserByClerkId = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique()

    if (!user) return

    // Cascade-delete all associated data (no Clerk API call needed — Clerk triggered this webhook)
    await cascadeDeleteUserData(ctx, user._id)
  },
})

// ── URL helpers ───────────────────────────────────────────────────────

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    return u.toString()
  } catch {
    return url
  }
}

function extractUTMParams(url: string): {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
} {
  try {
    const u = new URL(url)
    return {
      source: u.searchParams.get('utm_source') || undefined,
      medium: u.searchParams.get('utm_medium') || undefined,
      campaign: u.searchParams.get('utm_campaign') || undefined,
      term: u.searchParams.get('utm_term') || undefined,
      content: u.searchParams.get('utm_content') || undefined,
    }
  } catch {
    return {}
  }
}

function utcDayStartMs(dayUtc: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayUtc)
  // The action computes dayUtc via utcDayKey() so an invalid value here
  // is a programmer bug. Throw rather than returning 0 (which would widen
  // the index filter to the entire history of events).
  if (!m) throw new Error(`utcDayStartMs: invalid dayUtc "${dayUtc}"`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function degradedIpBucket(websiteId: string): string {
  return `degraded-ip:${websiteId.slice(0, 128)}`
}
