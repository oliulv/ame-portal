import { query, mutation } from './functions'
import { v } from 'convex/values'
import { requireFounder, getFounderStartupIds } from './auth'

/**
 * List tracker websites for the current founder.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    if (startupIds.length === 0) return []

    return await ctx.db
      .query('trackerWebsites')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupIds[0]))
      .collect()
  },
})

/**
 * Create a tracker website.
 */
export const create = mutation({
  args: {
    name: v.string(),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    if (startupIds.length === 0) throw new Error('No startup found')

    // Check for duplicate domain
    if (args.domain) {
      const existing = await ctx.db
        .query('trackerWebsites')
        .withIndex('by_startupId', (q) => q.eq('startupId', startupIds[0]))
        .filter((q) => q.eq(q.field('domain'), args.domain))
        .first()

      if (existing) {
        throw new Error('A tracker website with this domain already exists')
      }
    }

    return await ctx.db.insert('trackerWebsites', {
      startupId: startupIds[0],
      name: args.name,
      domain: args.domain,
    })
  },
})

/**
 * Update a tracker website.
 */
export const update = mutation({
  args: {
    id: v.id('trackerWebsites'),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    const website = await ctx.db.get(args.id)
    if (!website || !startupIds.includes(website.startupId)) {
      throw new Error('Tracker website not found')
    }

    const patch: Record<string, unknown> = {}
    if (args.name !== undefined) patch.name = args.name
    if (args.domain !== undefined) patch.domain = args.domain

    await ctx.db.patch(args.id, patch)
  },
})

/**
 * Delete a tracker website.
 */
export const remove = mutation({
  args: { id: v.id('trackerWebsites') },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    const website = await ctx.db.get(args.id)
    if (!website || !startupIds.includes(website.startupId)) {
      throw new Error('Tracker website not found')
    }

    await ctx.db.delete(args.id)
  },
})
