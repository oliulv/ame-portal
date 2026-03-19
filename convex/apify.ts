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
 * Actor: apidojo/tweet-scraper (Tweet Scraper V2)
 * Input: twitterHandles (array of usernames), maxItems
 * Output: author object with follower data, likeCount, retweetCount, replyCount per tweet
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
        `https://api.apify.com/v2/acts/apidojo~tweet-scraper/run-sync-get-dataset-items?token=${apiToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            twitterHandles: [args.handle.replace(/^@/, '')],
            maxItems: 20,
          }),
        }
      )

      if (!response.ok) throw new Error(`Apify API error: ${response.status}`)

      const data = await response.json()
      if (!Array.isArray(data) || data.length === 0) return

      // Extract profile info from the author object on the first tweet
      const author = data[0]?.author
      const followers = author?.followers ?? author?.followersCount ?? 0
      const following = author?.following ?? author?.friendsCount ?? 0

      // Calculate engagement from recent tweets
      const totalInteractions = data.reduce((sum: number, tweet: any) => {
        return sum + (tweet.likeCount ?? 0) + (tweet.retweetCount ?? 0) + (tweet.replyCount ?? 0)
      }, 0)
      const engagementRate = followers > 0 ? (totalInteractions / data.length / followers) * 100 : 0

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
          {
            startupId: args.startupId,
            provider: 'apify' as const,
            metricKey: 'twitter_interactions',
            value: totalInteractions,
            timestamp,
            window: 'daily' as const,
          },
          {
            startupId: args.startupId,
            provider: 'apify' as const,
            metricKey: 'twitter_engagement_rate',
            value: engagementRate,
            timestamp,
            window: 'daily' as const,
          },
          {
            startupId: args.startupId,
            provider: 'apify' as const,
            metricKey: 'twitter_posts',
            value: data.length,
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
 * Actor: dev_fusion/linkedin-company-scraper (Bulk LinkedIn Company Profile Scraper, No Cookies)
 * Input: urls (array of LinkedIn company URLs)
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
            urls: [url],
          }),
        }
      )

      if (!response.ok) throw new Error(`Apify API error: ${response.status}`)

      const data = await response.json()
      if (!Array.isArray(data) || data.length === 0) return

      const company = data[0]
      // dev_fusion scraper uses stats.follower_count or top-level followerCount
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
 * Actor: apify/instagram-profile-scraper
 * Input: usernames (array)
 * Output: followersCount, followsCount, postsCount, biography, fullName, etc.
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
        `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apiToken}`,
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
      const followers = profile?.followersCount ?? 0
      const following = profile?.followsCount ?? 0
      const posts = profile?.postsCount ?? 0

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
