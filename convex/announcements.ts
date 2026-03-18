import { query, mutation } from './functions'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireAdmin, requireFounder, getFounderStartupIds } from './auth'

/**
 * Create and send an announcement to all founders in a cohort.
 */
export const send = mutation({
  args: {
    cohortId: v.id('cohorts'),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const title = args.title.trim()
    const body = args.body.trim()
    if (title.length === 0 || title.length > 100) {
      throw new Error('Title must be between 1 and 100 characters')
    }
    if (body.length === 0 || body.length > 500) {
      throw new Error('Body must be between 1 and 500 characters')
    }

    const cohort = await ctx.db.get(args.cohortId)
    if (!cohort) throw new Error('Cohort not found')

    // Count founders in cohort for recipientCount
    const startups = await ctx.db
      .query('startups')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    let founderCount = 0
    for (const startup of startups) {
      const profiles = await ctx.db
        .query('founderProfiles')
        .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
        .collect()
      founderCount += profiles.length
    }

    const announcementId = await ctx.db.insert('announcements', {
      cohortId: args.cohortId,
      title: args.title.trim(),
      body: args.body.trim(),
      sentByUserId: admin._id,
      sentAt: new Date().toISOString(),
      recipientCount: founderCount,
    })

    // Schedule WhatsApp notification
    await ctx.scheduler.runAfter(0, internal.whatsapp.sendAnnouncementNotification, {
      cohortId: args.cohortId,
      title: args.title.trim(),
      body: args.body.trim(),
    })

    return announcementId
  },
})

/**
 * List announcements for a cohort (admin view).
 */
export const listForAdmin = query({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const announcements = await ctx.db
      .query('announcements')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const enriched = await Promise.all(
      announcements.map(async (a) => {
        const sender = await ctx.db.get(a.sentByUserId)
        return {
          ...a,
          senderName: sender?.fullName ?? sender?.email ?? 'Unknown',
        }
      })
    )

    return enriched.sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  },
})

/**
 * List announcements for the current founder's cohort.
 */
export const listForFounder = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) return []

    const startup = await ctx.db.get(startupIds[0])
    if (!startup) return []

    const announcements = await ctx.db
      .query('announcements')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', startup.cohortId))
      .collect()

    return announcements.sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  },
})

/**
 * Get recent announcements for founder dashboard (last 3).
 */
export const recentForFounder = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) return []

    const startup = await ctx.db.get(startupIds[0])
    if (!startup) return []

    const announcements = await ctx.db
      .query('announcements')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', startup.cohortId))
      .collect()

    return announcements.sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 3)
  },
})
