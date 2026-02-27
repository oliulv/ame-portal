import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'

const http = httpRouter()

// ── CORS headers for tracker ──────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
      const body = await request.json()
      const { type, payload } = body

      if (!type || !payload || !payload.website) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Store the event via internal mutation
      await ctx.runMutation(internal.http.insertTrackerEvent, {
        websiteId: payload.website,
        eventName: type === 'event' && payload.name ? payload.name : undefined,
        sessionId: payload.id || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        url: payload.url || '',
        referrer: payload.referrer || undefined,
        screen: payload.screen || undefined,
        language: payload.language || undefined,
        title: payload.title || undefined,
        hostname: payload.hostname || undefined,
        data: payload.data || undefined,
      })

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('Tracker collect error:', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }),
})

// ── Clerk webhook ─────────────────────────────────────────────────────
http.route({
  path: '/clerk/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json()
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
      console.error('Clerk webhook error:', error)
      return new Response('Internal server error', { status: 500 })
    }
  }),
})

export default http

// ── Internal mutations used by HTTP actions ───────────────────────────
import { internalMutation } from './_generated/server'
import { v } from 'convex/values'

export const insertTrackerEvent = internalMutation({
  args: {
    websiteId: v.string(), // Passed as string from external, validated below
    eventName: v.optional(v.string()),
    sessionId: v.string(),
    url: v.string(),
    referrer: v.optional(v.string()),
    screen: v.optional(v.string()),
    language: v.optional(v.string()),
    title: v.optional(v.string()),
    hostname: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Validate website exists — websiteId comes from an external source as a string
    const normalizedId = ctx.db.normalizeId('trackerWebsites', args.websiteId)
    if (!normalizedId) return

    const website = await ctx.db.get(normalizedId)
    if (!website) return

    // Extract UTM params from URL
    const utmParams = extractUTMParams(args.url)

    await ctx.db.insert('trackerEvents', {
      websiteId: normalizedId,
      sessionId: args.sessionId,
      eventName: args.eventName,
      url: normalizeUrl(args.url),
      referrer: args.referrer ? normalizeUrl(args.referrer) : undefined,
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

    // Cascade-delete all founder profiles
    const founderProfiles = await ctx.db
      .query('founderProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect()

    for (const profile of founderProfiles) {
      await ctx.db.delete(profile._id)
    }

    // Cascade-delete all admin cohort assignments
    const adminCohorts = await ctx.db
      .query('adminCohorts')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect()

    for (const assignment of adminCohorts) {
      await ctx.db.delete(assignment._id)
    }

    // Cascade-delete all perk claims
    const perkClaims = await ctx.db
      .query('perkClaims')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .collect()

    for (const claim of perkClaims) {
      await ctx.db.delete(claim._id)
    }

    // Delete the user record (no Clerk API call needed — Clerk triggered this webhook)
    await ctx.db.delete(user._id)
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
