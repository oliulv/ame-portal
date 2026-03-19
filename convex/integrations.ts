import { query, mutation, action } from './functions'
import { v } from 'convex/values'
import { requireFounder, requireAdmin, getFounderStartupIds } from './auth'
import { api, internal } from './_generated/api'

/**
 * Get integration connection status for the current founder's startup.
 */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    if (startupIds.length === 0) return { stripe: null }

    const connections = await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupIds[0]))
      .collect()

    const stripe = connections.find((c) => c.provider === 'stripe' && c.isActive)

    return {
      stripe: stripe
        ? {
            _id: stripe._id,
            status: stripe.status,
            accountName: stripe.accountName,
            connectedAt: stripe.connectedAt,
            lastSyncedAt: stripe.lastSyncedAt,
          }
        : null,
    }
  },
})

/**
 * Store a Stripe connection (after API key validation in action).
 */
export const storeStripeConnection = mutation({
  args: {
    startupId: v.id('startups'),
    accessToken: v.string(),
    accountId: v.string(),
    accountName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if connection already exists
    const existing = await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId_provider', (q) =>
        q.eq('startupId', args.startupId).eq('provider', 'stripe')
      )
      .first()

    const data = {
      startupId: args.startupId,
      provider: 'stripe' as const,
      accountId: args.accountId,
      accountName: args.accountName,
      accessToken: args.accessToken,
      status: 'active' as const,
      isActive: true,
      connectedAt: new Date().toISOString(),
    }

    if (existing) {
      await ctx.db.patch(existing._id, data)
    } else {
      await ctx.db.insert('integrationConnections', data)
    }
  },
})

/**
 * Disconnect Stripe integration.
 */
export const disconnectStripe = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    if (startupIds.length === 0) throw new Error('No startup found')

    const connection = await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId_provider', (q) =>
        q.eq('startupId', startupIds[0]).eq('provider', 'stripe')
      )
      .first()

    if (connection) {
      await ctx.db.patch(connection._id, {
        status: 'disconnected',
        isActive: false,
      })
    }
  },
})

/**
 * Connect Stripe via API key (action that validates with Stripe API).
 */
export const connectStripe = action({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the user's identity
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    // Look up user to get startup
    const user = await ctx.runQuery(api.users.current)
    if (!user || user.role !== 'founder') throw new Error('Founder access required')

    // We need to fetch startup IDs via an internal query
    // For now, validate the key with Stripe and store via mutation
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(args.apiKey, {
      apiVersion: '2025-11-17.clover',
    })

    const account = await stripe.accounts.retrieve()
    const accountId = account.id
    const accountName = account.business_profile?.name || account.email || 'Stripe Account'

    // Get founder's startup IDs
    const founderProfiles = await ctx.runQuery(api.integrations.getFounderStartupId)

    if (!founderProfiles) {
      throw new Error('No startup found')
    }

    await ctx.runMutation(api.integrations.storeStripeConnection, {
      startupId: founderProfiles,
      accessToken: args.apiKey,
      accountId,
      accountName,
    })

    // Schedule backfill of historical Stripe data
    await ctx.scheduler.runAfter(0, internal.metrics.backfillStripeHistory, {
      startupId: founderProfiles,
    })
  },
})

/**
 * Internal query to get founder's startup ID (used by connectStripe action).
 */
export const getFounderStartupId = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)
    return startupIds[0] ?? null
  },
})

/**
 * Store a GitHub connection.
 */
export const storeGithubConnection = mutation({
  args: {
    startupId: v.id('startups'),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.string()),
    accountId: v.string(),
    accountName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId_provider', (q) =>
        q.eq('startupId', args.startupId).eq('provider', 'github')
      )
      .first()

    const data = {
      startupId: args.startupId,
      provider: 'github' as const,
      accountId: args.accountId,
      accountName: args.accountName,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
      status: 'active' as const,
      isActive: true,
      connectedAt: new Date().toISOString(),
    }

    if (existing) {
      await ctx.db.patch(existing._id, data)
    } else {
      await ctx.db.insert('integrationConnections', data)
    }
  },
})

/**
 * Disconnect GitHub integration.
 */
export const disconnectGithub = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) throw new Error('No startup found')

    const connection = await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId_provider', (q) =>
        q.eq('startupId', startupIds[0]).eq('provider', 'github')
      )
      .first()

    if (connection) {
      await ctx.db.patch(connection._id, { status: 'disconnected', isActive: false })
    }
  },
})

/**
 * Save social media profiles for Apify scraping.
 */
export const saveSocialProfile = mutation({
  args: {
    platform: v.union(v.literal('twitter'), v.literal('linkedin'), v.literal('instagram')),
    handle: v.string(),
    profileUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) throw new Error('No startup found')
    const startupId = startupIds[0]

    const existing = await ctx.db
      .query('socialProfiles')
      .withIndex('by_startupId_platform', (q) =>
        q.eq('startupId', startupId).eq('platform', args.platform)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        handle: args.handle,
        profileUrl: args.profileUrl,
      })
    } else {
      await ctx.db.insert('socialProfiles', {
        startupId,
        platform: args.platform,
        handle: args.handle,
        profileUrl: args.profileUrl,
      })
    }
  },
})

/**
 * Get social profiles for the current founder's startup.
 */
export const getSocialProfiles = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) return []

    return await ctx.db
      .query('socialProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupIds[0]))
      .collect()
  },
})

/**
 * Get integration connection status including GitHub and social.
 */
export const fullStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) return { stripe: null, github: null, social: [] }

    const connections = await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupIds[0]))
      .collect()

    const stripe = connections.find((c) => c.provider === 'stripe' && c.isActive)
    const github = connections.find((c) => c.provider === 'github' && c.isActive)

    const socialProfiles = await ctx.db
      .query('socialProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupIds[0]))
      .collect()

    return {
      stripe: stripe
        ? {
            _id: stripe._id,
            status: stripe.status,
            accountName: stripe.accountName,
            connectedAt: stripe.connectedAt,
            lastSyncedAt: stripe.lastSyncedAt,
          }
        : null,
      github: github
        ? {
            _id: github._id,
            status: github.status,
            accountName: github.accountName,
            connectedAt: github.connectedAt,
            lastSyncedAt: github.lastSyncedAt,
          }
        : null,
      social: socialProfiles,
    }
  },
})

/**
 * Get integration connection status for a startup (admin-only).
 */
export const statusForAdmin = query({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const connections = await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()

    const stripeConn = connections.find((c) => c.provider === 'stripe' && c.isActive)

    const trackerWebsites = await ctx.db
      .query('trackerWebsites')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()

    const githubConn = connections.find((c) => c.provider === 'github' && c.isActive)

    const socialProfiles = await ctx.db
      .query('socialProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()

    return {
      stripe: stripeConn
        ? {
            status: stripeConn.status,
            accountName: stripeConn.accountName,
            lastSyncedAt: stripeConn.lastSyncedAt,
            syncError: stripeConn.syncError,
          }
        : null,
      tracker: trackerWebsites.length > 0 ? { websiteCount: trackerWebsites.length } : null,
      github: githubConn
        ? {
            status: githubConn.status,
            accountName: githubConn.accountName,
            lastSyncedAt: githubConn.lastSyncedAt,
            syncError: githubConn.syncError,
          }
        : null,
      social: socialProfiles,
    }
  },
})
