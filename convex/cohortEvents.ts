import { query, mutation } from './functions'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import {
  getAdminAccessibleCohortIds,
  requireAdmin,
  requireAdminForCohort,
  requireFounder,
  getFounderStartupIds,
} from './auth'

/**
 * List all events for a cohort (admin).
 */
export const list = query({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    await requireAdminForCohort(ctx, args.cohortId)

    const events = await ctx.db
      .query('cohortEvents')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    return events.sort((a, b) => a.date.localeCompare(b.date))
  },
})

/**
 * List all events across all cohorts (admin) — for event-linking dropdown.
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx)
    let events = await ctx.db.query('cohortEvents').collect()
    const accessibleCohortIds = await getAdminAccessibleCohortIds(ctx, admin)
    if (accessibleCohortIds !== null) {
      const allowed = new Set(accessibleCohortIds)
      events = events.filter((event) => allowed.has(event.cohortId))
    }
    // Enrich with cohort info
    const enriched = await Promise.all(
      events.map(async (event) => {
        const cohort = await ctx.db.get(event.cohortId)
        return { ...event, cohortName: cohort?.label ?? 'Unknown' }
      })
    )
    return enriched.sort((a, b) => b.date.localeCompare(a.date))
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
    await requireAdminForCohort(ctx, args.cohortId)

    const existing = await ctx.db
      .query('cohortEvents')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const eventId = await ctx.db.insert('cohortEvents', {
      cohortId: args.cohortId,
      title: args.title,
      description: args.description,
      date: args.date,
      lumaEmbedUrl: args.lumaEmbedUrl,
      sortOrder: existing.length,
      isActive: true,
    })

    // Notify founders about the new event
    await ctx.scheduler.runAfter(0, internal.notifications.notifyEventCreated, {
      cohortId: args.cohortId,
      eventTitle: args.title,
      eventDate: args.date,
    })

    return eventId
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
    const { id, ...updates } = args
    const event = await ctx.db.get(id)
    if (!event) throw new Error('Event not found')
    await requireAdminForCohort(ctx, event.cohortId)

    const patch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value
      }
    }

    await ctx.db.patch(id, patch)

    // Notify founders about event updates
    if (args.isActive === false && event.isActive) {
      // Event was deactivated (cancelled)
      await ctx.scheduler.runAfter(0, internal.notifications.notifyEventCancelled, {
        cohortId: event.cohortId,
        eventTitle: event.title,
      })
    } else if (args.isActive !== false) {
      // Event details were updated (title, date, etc.)
      const hasContentChanges =
        args.title !== undefined || args.date !== undefined || args.description !== undefined
      if (hasContentChanges) {
        await ctx.scheduler.runAfter(0, internal.notifications.notifyEventUpdated, {
          cohortId: event.cohortId,
          eventTitle: args.title ?? event.title,
        })
      }
    }
  },
})

/**
 * Delete an event (admin).
 */
export const remove = mutation({
  args: { id: v.id('cohortEvents') },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.id)
    if (!event) throw new Error('Event not found')
    await requireAdminForCohort(ctx, event.cohortId)

    // Notify founders before deleting
    if (event.isActive) {
      await ctx.scheduler.runAfter(0, internal.notifications.notifyEventCancelled, {
        cohortId: event.cohortId,
        eventTitle: event.title,
      })
    }

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

    const today = new Date().toISOString().slice(0, 10)
    const activeEvents = events
      .filter((e) => e.isActive && e.date >= today)
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

    const today = new Date().toISOString().slice(0, 10)

    const events = await ctx.db
      .query('cohortEvents')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', startup.cohortId))
      .collect()

    const upcoming = events
      .filter((e) => e.isActive && e.date >= today)
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
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) throw new Error('No startup found')
    const startup = await ctx.db.get(startupIds[0])
    if (!startup || startup.cohortId !== event.cohortId) {
      throw new Error('Not authorized for this event')
    }

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
    const event = await ctx.db.get(args.eventId)
    if (!event) throw new Error('Event not found')
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) throw new Error('No startup found')
    const startup = await ctx.db.get(startupIds[0])
    if (!startup || startup.cohortId !== event.cohortId) {
      throw new Error('Not authorized for this event')
    }

    const existing = await ctx.db
      .query('eventRegistrations')
      .withIndex('by_eventId_userId', (q) => q.eq('eventId', args.eventId).eq('userId', user._id))
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})
