import { internalAction, internalQuery, internalMutation } from './functions'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { logConvexError } from './lib/logging'

/**
 * Get all social profiles that need scraping.
 */
export const getAllSocialProfiles = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('socialProfiles').collect()
  },
})

/**
 * Update scrape status on a social profile.
 */
export const updateScrapeStatus = internalMutation({
  args: {
    profileId: v.id('socialProfiles'),
    lastScrapedAt: v.optional(v.string()),
    scrapeError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      lastScrapedAt: args.lastScrapedAt,
      scrapeError: args.scrapeError,
    })
  },
})

/**
 * Scrape a Twitter/X profile via Apify.
 * Actor: apidojo/twitter-user-scraper (profile-only, ~$0.001/profile)
 * Input: twitterHandles (array of usernames)
 * Output: profile object with follower/following counts
 */
export const scrapeTwitterProfile = internalAction({
  args: {
    profileId: v.id('socialProfiles'),
    startupId: v.id('startups'),
    handle: v.string(),
  },
  handler: async (ctx, args) => {
    const apiToken = process.env.APIFY_API_TOKEN
    if (!apiToken) return

    try {
      const response = await fetch(
        `https://api.apify.com/v2/acts/apidojo~twitter-user-scraper/run-sync-get-dataset-items?token=${apiToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            twitterHandles: [args.handle.replace(/^@/, '')],
            getFollowers: false,
            getFollowing: false,
            maxItems: 1,
          }),
        }
      )

      if (!response.ok) throw new Error(`Apify API error: ${response.status}`)

      const data = await response.json()
      if (!Array.isArray(data) || data.length === 0) return

      const profile = data[0]
      const followers =
        profile?.followers ??
        profile?.followersCount ??
        profile?.followerCount ??
        profile?.public_metrics?.followers_count ??
        0
      const following =
        profile?.following ??
        profile?.followingCount ??
        profile?.friendsCount ??
        profile?.public_metrics?.following_count ??
        0

      const timestamp = new Date().toISOString()

      await ctx.runMutation(internal.metrics.storeInternal, {
        snapshots: [
          {
            startupId: args.startupId,
            provider: 'apify' as const,
            metricKey: 'twitter_followers',
            value: followers,
            timestamp,
            window: 'daily' as const,
          },
          {
            startupId: args.startupId,
            provider: 'apify' as const,
            metricKey: 'twitter_following',
            value: following,
            timestamp,
            window: 'daily' as const,
          },
        ],
      })

      await ctx.runMutation(internal.apify.updateScrapeStatus, {
        profileId: args.profileId,
        lastScrapedAt: timestamp,
        scrapeError: undefined,
      })
    } catch (error) {
      logConvexError(`Error scraping Twitter @${args.handle}:`, error)
      await ctx.runMutation(internal.apify.updateScrapeStatus, {
        profileId: args.profileId,
        scrapeError: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
})

/**
 * Scrape a LinkedIn company profile via Apify.
 * Actor: dev_fusion/linkedin-company-scraper (no cookies, ~$8/1K results)
 * Input: profileUrls (array of LinkedIn company URLs)
 * Output: stats.follower_count, stats.employee_count, name, etc.
 */
export const scrapeLinkedInProfile = internalAction({
  args: {
    profileId: v.id('socialProfiles'),
    startupId: v.id('startups'),
    handle: v.string(),
    profileUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiToken = process.env.APIFY_API_TOKEN
    if (!apiToken) return

    try {
      const url = args.profileUrl || `https://www.linkedin.com/company/${args.handle}`

      const response = await fetch(
        `https://api.apify.com/v2/acts/dev_fusion~linkedin-company-scraper/run-sync-get-dataset-items?token=${apiToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileUrls: [url],
          }),
        }
      )

      if (!response.ok) throw new Error(`Apify API error: ${response.status}`)

      const data = await response.json()
      if (!Array.isArray(data) || data.length === 0) return

      const company = data[0]
      const followers =
        company?.stats?.follower_count ??
        company?.followerCount ??
        company?.followersCount ??
        company?.follower_count ??
        0

      const timestamp = new Date().toISOString()

      await ctx.runMutation(internal.metrics.storeInternal, {
        snapshots: [
          {
            startupId: args.startupId,
            provider: 'apify' as const,
            metricKey: 'linkedin_followers',
            value: followers,
            timestamp,
            window: 'daily' as const,
          },
        ],
      })

      await ctx.runMutation(internal.apify.updateScrapeStatus, {
        profileId: args.profileId,
        lastScrapedAt: timestamp,
        scrapeError: undefined,
      })
    } catch (error) {
      logConvexError(`Error scraping LinkedIn ${args.handle}:`, error)
      await ctx.runMutation(internal.apify.updateScrapeStatus, {
        profileId: args.profileId,
        scrapeError: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
})

/**
 * Scrape an Instagram profile via Apify.
 * Actor: apidojo/instagram-user-scraper (profile-only, ~$0.01/profile)
 * Input: usernames (array)
 * Output: followersCount, followsCount, postsCount, etc.
 */
export const scrapeInstagramProfile = internalAction({
  args: {
    profileId: v.id('socialProfiles'),
    startupId: v.id('startups'),
    handle: v.string(),
  },
  handler: async (ctx, args) => {
    const apiToken = process.env.APIFY_API_TOKEN
    if (!apiToken) return

    try {
      const response = await fetch(
        `https://api.apify.com/v2/acts/apidojo~instagram-user-scraper/run-sync-get-dataset-items?token=${apiToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usernames: [args.handle.replace(/^@/, '')],
          }),
        }
      )

      if (!response.ok) throw new Error(`Apify API error: ${response.status}`)

      const data = await response.json()
      if (!Array.isArray(data) || data.length === 0) return

      const profile = data[0]
      const followers = profile?.followersCount ?? profile?.followerCount ?? profile?.followers ?? 0
      const following = profile?.followsCount ?? profile?.followingCount ?? profile?.following ?? 0
      const posts = profile?.postsCount ?? profile?.mediaCount ?? profile?.posts ?? 0

      const timestamp = new Date().toISOString()

      await ctx.runMutation(internal.metrics.storeInternal, {
        snapshots: [
          {
            startupId: args.startupId,
            provider: 'apify' as const,
            metricKey: 'instagram_followers',
            value: followers,
            timestamp,
            window: 'daily' as const,
          },
          {
            startupId: args.startupId,
            provider: 'apify' as const,
            metricKey: 'instagram_following',
            value: following,
            timestamp,
            window: 'daily' as const,
          },
          {
            startupId: args.startupId,
            provider: 'apify' as const,
            metricKey: 'instagram_posts',
            value: posts,
            timestamp,
            window: 'daily' as const,
          },
        ],
      })

      await ctx.runMutation(internal.apify.updateScrapeStatus, {
        profileId: args.profileId,
        lastScrapedAt: timestamp,
        scrapeError: undefined,
      })
    } catch (error) {
      logConvexError(`Error scraping Instagram @${args.handle}:`, error)
      await ctx.runMutation(internal.apify.updateScrapeStatus, {
        profileId: args.profileId,
        scrapeError: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
})

/**
 * Scrape all social profiles (daily cron target).
 */
export const scrapeAllProfiles = internalAction({
  args: {},
  handler: async (ctx) => {
    const profiles: any[] = await ctx.runQuery(internal.apify.getAllSocialProfiles)

    for (const profile of profiles) {
      const baseArgs = {
        profileId: profile._id,
        startupId: profile.startupId,
        handle: profile.handle,
      }

      switch (profile.platform) {
        case 'twitter':
          await ctx.scheduler.runAfter(0, internal.apify.scrapeTwitterProfile, baseArgs)
          break
        case 'linkedin':
          await ctx.scheduler.runAfter(0, internal.apify.scrapeLinkedInProfile, {
            ...baseArgs,
            profileUrl: profile.profileUrl,
          })
          break
        case 'instagram':
          await ctx.scheduler.runAfter(0, internal.apify.scrapeInstagramProfile, baseArgs)
          break
      }
    }
  },
})
