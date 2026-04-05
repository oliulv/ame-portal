import {
  query,
  mutation,
  action,
  internalMutation,
  internalAction,
  internalQuery,
} from './functions'
import { v } from 'convex/values'
import { requireFounder, requireAdmin, requireStartupAccess, getFounderStartupIds } from './auth'
import { api, internal } from './_generated/api'
import { logConvexError } from './lib/logging'

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
 * Store a Stripe connection — called by the Stripe OAuth callback route.
 * Auth-gated: caller must be a founder who owns this startup.
 */
export const storeStripeConnection = mutation({
  args: {
    startupId: v.id('startups'),
    accessToken: v.string(),
    accountId: v.string(),
    accountName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStartupAccess(ctx, args.startupId)

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
 * Store a GitHub connection — called by the GitHub OAuth callback route.
 * Auth-gated: caller must be a founder who owns this startup.
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
    const user = await requireStartupAccess(ctx, args.startupId)

    // Find existing connection for the SAME GitHub account (re-auth), not just any connection
    const allGithubConns = await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId_provider', (q) =>
        q.eq('startupId', args.startupId).eq('provider', 'github')
      )
      .collect()

    const existing = allGithubConns.find((c) => c.accountId === args.accountId)

    // Prevent the same GitHub account from being connected by a different user (would double-count)
    const duplicateByOther = allGithubConns.find(
      (c) => c.accountId === args.accountId && c.isActive && c.connectedByUserId !== user._id
    )
    if (duplicateByOther) {
      throw new Error(
        `GitHub account @${args.accountName ?? args.accountId} is already connected by another team member`
      )
    }

    const data = {
      startupId: args.startupId,
      provider: 'github' as const,
      accountId: args.accountId,
      accountName: args.accountName,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
      connectedByUserId: user._id,
      status: 'active' as const,
      isActive: true,
      connectedAt: new Date().toISOString(),
    }

    let connectionId: any
    if (existing) {
      await ctx.db.patch(existing._id, data)
      connectionId = existing._id
    } else {
      connectionId = await ctx.db.insert('integrationConnections', data)
    }

    // Trigger immediate sync after connection
    await ctx.scheduler.runAfter(0, internal.metrics.syncGithubForStartup, {
      startupId: args.startupId,
      connectionId: connectionId!,
    })
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

    // Find this user's GitHub connection specifically
    const connections = await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId_provider', (q) =>
        q.eq('startupId', startupIds[0]).eq('provider', 'github')
      )
      .collect()

    // Only disconnect the current user's own connection — never touch other founders' connections.
    // Fallback to first connection only for legacy rows that don't have connectedByUserId set.
    const myConnection =
      connections.find((c) => c.connectedByUserId === user._id) ??
      (connections.length === 1 ? connections[0] : null)

    if (myConnection) {
      await ctx.db.patch(myConnection._id, { status: 'disconnected', isActive: false })
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

    let profileId: any
    if (existing) {
      await ctx.db.patch(existing._id, {
        handle: args.handle,
        profileUrl: args.profileUrl,
      })
      profileId = existing._id
    } else {
      profileId = await ctx.db.insert('socialProfiles', {
        startupId,
        platform: args.platform,
        handle: args.handle,
        profileUrl: args.profileUrl,
      })
    }

    // Data will be scraped by the daily cron (6am UTC).
    // Use triggerSocialScrape for manual "Scrape now" if needed.
  },
})

/**
 * Trigger a scrape for a single social profile (internal, used after save).
 */
export const triggerSocialScrape = internalMutation({
  args: {
    profileId: v.id('socialProfiles'),
    startupId: v.id('startups'),
    platform: v.union(v.literal('twitter'), v.literal('linkedin'), v.literal('instagram')),
    handle: v.string(),
    profileUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const baseArgs = {
      profileId: args.profileId,
      startupId: args.startupId,
      handle: args.handle,
    }

    switch (args.platform) {
      case 'twitter':
        await ctx.scheduler.runAfter(0, internal.apify.scrapeTwitterProfile, baseArgs)
        break
      case 'linkedin':
        await ctx.scheduler.runAfter(0, internal.apify.scrapeLinkedInProfile, {
          ...baseArgs,
          profileUrl: args.profileUrl,
        })
        break
      case 'instagram':
        await ctx.scheduler.runAfter(0, internal.apify.scrapeInstagramProfile, baseArgs)
        break
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
    if (startupIds.length === 0)
      return { stripe: null, github: null, githubConnections: [], social: [] }

    const connections = await ctx.db
      .query('integrationConnections')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupIds[0]))
      .collect()

    const stripe = connections.find((c) => c.provider === 'stripe' && c.isActive)
    const githubConns = connections.filter((c) => c.provider === 'github' && c.isActive)
    const myGithub = githubConns.find((c) => c.connectedByUserId === user._id) ?? githubConns[0]

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
            syncError: stripe.syncError,
          }
        : null,
      // Primary connection (current user's, or first found) — for backward compat
      github: myGithub
        ? {
            _id: myGithub._id,
            status: myGithub.status,
            accountName: myGithub.accountName,
            connectedAt: myGithub.connectedAt,
            lastSyncedAt: myGithub.lastSyncedAt,
            syncError: myGithub.syncError,
          }
        : null,
      // All active GitHub connections — for showing team members
      githubConnections: githubConns.map((c) => ({
        _id: c._id,
        status: c.status,
        accountName: c.accountName,
        connectedAt: c.connectedAt,
        lastSyncedAt: c.lastSyncedAt,
        syncError: c.syncError,
        connectedByUserId: c.connectedByUserId,
      })),
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

    const githubConns = connections.filter((c) => c.provider === 'github' && c.isActive)

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
      github:
        githubConns.length > 0
          ? {
              // Active if any connection is active, error only if all are in error
              status: githubConns.some((c) => c.status === 'active')
                ? 'active'
                : githubConns[0].status,
              accountName: githubConns
                .map((c) => c.accountName)
                .filter(Boolean)
                .join(', '),
              lastSyncedAt: githubConns
                .map((c) => c.lastSyncedAt)
                .filter(Boolean)
                .sort()
                .pop(),
              syncError: githubConns.find((c) => c.syncError)?.syncError,
            }
          : null,
      social: socialProfiles,
    }
  },
})

// ── Token Refresh ────────────────────────────────────────────────────

/**
 * Refresh a GitHub access token using the refresh token.
 * GitHub App tokens expire after 8 hours; OAuth app tokens don't expire.
 * This handles the GitHub App case gracefully and is a no-op for OAuth apps.
 */
export const refreshGithubToken = internalAction({
  args: { connectionId: v.id('integrationConnections') },
  handler: async (ctx, args) => {
    const connection: any = await ctx.runQuery(internal.integrations.getConnectionById, {
      connectionId: args.connectionId,
    })
    if (!connection) return

    // If no refresh token or no expiry, token doesn't expire (OAuth app) — skip
    if (!connection.refreshToken || !connection.tokenExpiresAt) return

    // Check if token expires within the next 10 minutes
    const expiresAt = new Date(connection.tokenExpiresAt).getTime()
    const tenMinutesFromNow = Date.now() + 10 * 60 * 1000
    if (expiresAt > tenMinutesFromNow) return // Token still valid

    const clientId = process.env.GITHUB_APP_CLIENT_ID
    const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      logConvexError('GitHub token refresh failed: missing GITHUB_APP_CLIENT_ID or SECRET', null)
      return
    }

    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: connection.refreshToken,
        }),
      })

      if (!response.ok) {
        throw new Error(`GitHub token refresh HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(`GitHub token refresh: ${data.error_description || data.error}`)
      }

      await ctx.runMutation(internal.integrations.updateConnectionToken, {
        connectionId: args.connectionId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? connection.refreshToken,
        tokenExpiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000).toISOString()
          : undefined,
      })
    } catch (error) {
      logConvexError(`GitHub token refresh failed for connection ${args.connectionId}:`, error)
      await ctx.runMutation(internal.metrics.updateConnectionSyncStatus, {
        connectionId: args.connectionId,
        syncError: `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      })
    }
  },
})

/**
 * Get a connection by ID (internal).
 */
export const getConnectionById = internalQuery({
  args: { connectionId: v.id('integrationConnections') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.connectionId)
  },
})

/**
 * Update a connection's access token after refresh.
 */
export const updateConnectionToken = internalMutation({
  args: {
    connectionId: v.id('integrationConnections'),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      accessToken: args.accessToken,
      ...(args.refreshToken ? { refreshToken: args.refreshToken } : {}),
      ...(args.tokenExpiresAt ? { tokenExpiresAt: args.tokenExpiresAt } : {}),
    })
  },
})

/**
 * Get integration connection status for all startups in a cohort.
 * Returns a map of startupId → { stripe, github, tracker } booleans.
 */
export const statusByCohort = query({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const startups = await ctx.db
      .query('startups')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const result: Record<string, { stripe: boolean; github: boolean; tracker: boolean }> = {}

    for (const startup of startups) {
      const connections = await ctx.db
        .query('integrationConnections')
        .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
        .collect()

      const trackerWebsites = await ctx.db
        .query('trackerWebsites')
        .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
        .collect()

      const active = connections.filter((c) => c.isActive && c.status === 'active')
      result[startup._id] = {
        stripe: active.some((c) => c.provider === 'stripe'),
        github: active.some((c) => c.provider === 'github'),
        tracker: trackerWebsites.length > 0,
      }
    }

    return result
  },
})
