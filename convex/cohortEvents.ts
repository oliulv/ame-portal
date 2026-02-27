import { query, mutation } from './functions'
import { v } from 'convex/values'
import { requireAdmin, requireFounder, getFounderStartupIds } from './auth'

/**
 * List all events for a cohort (admin).
 */
export const list = query({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const events = await ctx.db
      .query('cohortEvents')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    return events.sort((a, b) => a.date.localeCompare(b.date))
  },
})

/**
 * Create an event (admin).
 */
export const create = mutation({
  args: {
    cohortId: v.id('cohorts'),
    title: v.string(),
    description: v.optional(v.string()),
    date: v.string(),
    lumaEmbedUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const existing = await ctx.db
      .query('cohortEvents')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    return await ctx.db.insert('cohortEvents', {
      cohortId: args.cohortId,
      title: args.title,
      description: args.description,
      date: args.date,
      lumaEmbedUrl: args.lumaEmbedUrl,
      sortOrder: existing.length,
      isActive: true,
    })
  },
})

/**
 * Update an event (admin).
 */
export const update = mutation({
  args: {
    id: v.id('cohortEvents'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    date: v.optional(v.string()),
    lumaEmbedUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const { id, ...updates } = args
    const event = await ctx.db.get(id)
    if (!event) throw new Error('Event not found')

    const patch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value
      }
    }

    await ctx.db.patch(id, patch)
  },
})

/**
 * Delete an event (admin).
 */
export const remove = mutation({
  args: { id: v.id('cohortEvents') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const event = await ctx.db.get(args.id)
    if (!event) throw new Error('Event not found')

    await ctx.db.delete(args.id)
  },
})

/**
 * List active events for the current founder's cohort (with registration status).
 */
export const listForFounder = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    if (startupIds.length === 0) return []

    const startup = await ctx.db.get(startupIds[0])
    if (!startup) return []

    const events = await ctx.db
      .query('cohortEvents')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', startup.cohortId))
      .collect()

    const activeEvents = events
      .filter((e) => e.isActive)
      .sort((a, b) => a.date.localeCompare(b.date))

    // Check registration status for each event
    return await Promise.all(
      activeEvents.map(async (event) => {
        const registration = await ctx.db
          .query('eventRegistrations')
          .withIndex('by_eventId_userId', (q) => q.eq('eventId', event._id).eq('userId', user._id))
          .unique()

        return {
          ...event,
          isRegistered: !!registration,
        }
      })
    )
  },
})

/**
 * Get the next upcoming event for the current founder (with registration status).
 */
export const nextForFounder = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    if (startupIds.length === 0) return null

    const startup = await ctx.db.get(startupIds[0])
    if (!startup) return null

    const now = new Date().toISOString()

    const events = await ctx.db
      .query('cohortEvents')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', startup.cohortId))
      .collect()

    const upcoming = events
      .filter((e) => e.isActive && e.date >= now)
      .sort((a, b) => a.date.localeCompare(b.date))

    const next = upcoming[0]
    if (!next) return null

    const registration = await ctx.db
      .query('eventRegistrations')
      .withIndex('by_eventId_userId', (q) => q.eq('eventId', next._id).eq('userId', user._id))
      .unique()

    return { ...next, isRegistered: !!registration }
  },
})

/**
 * Register for an event (founder).
 */
export const register = mutation({
  args: { eventId: v.id('cohortEvents') },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)

    const event = await ctx.db.get(args.eventId)
    if (!event) throw new Error('Event not found')

    // Check if already registered
    const existing = await ctx.db
      .query('eventRegistrations')
      .withIndex('by_eventId_userId', (q) => q.eq('eventId', args.eventId).eq('userId', user._id))
      .unique()

    if (existing) return existing._id

    return await ctx.db.insert('eventRegistrations', {
      eventId: args.eventId,
      userId: user._id,
      registeredAt: new Date().toISOString(),
    })
  },
})

/**
 * Unregister from an event (founder).
 */
export const unregister = mutation({
  args: { eventId: v.id('cohortEvents') },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)

    const existing = await ctx.db
      .query('eventRegistrations')
      .withIndex('by_eventId_userId', (q) => q.eq('eventId', args.eventId).eq('userId', user._id))
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})
