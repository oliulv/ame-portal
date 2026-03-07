import { query, mutation } from './functions'
import { v } from 'convex/values'
import { requireAdmin, requireAuth } from './auth'

/**
 * List all resources with event title (admin).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const resources = await ctx.db.query('resources').collect()
    const sorted = resources.sort((a, b) => a.sortOrder - b.sortOrder)

    const enriched = await Promise.all(
      sorted.map(async (resource) => {
        let eventTitle: string | undefined
        if (resource.eventId) {
          const event = await ctx.db.get(resource.eventId)
          eventTitle = event?.title
        }
        return { ...resource, eventTitle }
      })
    )

    return enriched
  },
})

/**
 * List active resources for founders, enriched with event title.
 */
export const listForFounder = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx)

    const resources = await ctx.db.query('resources').collect()
    const active = resources.filter((r) => r.isActive).sort((a, b) => a.sortOrder - b.sortOrder)

    const enriched = await Promise.all(
      active.map(async (resource) => {
        let eventTitle: string | undefined
        if (resource.eventId) {
          const event = await ctx.db.get(resource.eventId)
          eventTitle = event?.title
        }
        return { ...resource, eventTitle }
      })
    )

    return enriched
  },
})

/**
 * Create a resource (admin).
 */
export const create = mutation({
  args: {
    title: v.string(),
    category: v.union(
      v.literal('video'),
      v.literal('podcast'),
      v.literal('book'),
      v.literal('other_reading')
    ),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    storageId: v.optional(v.id('_storage')),
    fileName: v.optional(v.string()),
    eventId: v.optional(v.id('cohortEvents')),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const existing = await ctx.db.query('resources').collect()
    const sortOrder = existing.length

    return await ctx.db.insert('resources', {
      title: args.title,
      category: args.category,
      description: args.description,
      url: args.url,
      storageId: args.storageId,
      fileName: args.fileName,
      eventId: args.eventId,
      isActive: args.isActive ?? true,
      sortOrder,
    })
  },
})

/**
 * Update a resource (admin).
 */
export const update = mutation({
  args: {
    id: v.id('resources'),
    title: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal('video'),
        v.literal('podcast'),
        v.literal('book'),
        v.literal('other_reading')
      )
    ),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    storageId: v.optional(v.id('_storage')),
    fileName: v.optional(v.string()),
    eventId: v.optional(v.id('cohortEvents')),
    isActive: v.optional(v.boolean()),
    clearFile: v.optional(v.boolean()),
    clearEvent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const { id, clearFile, clearEvent, ...updates } = args
    const resource = await ctx.db.get(id)
    if (!resource) throw new Error('Resource not found')

    const patch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value
      }
    }

    if (clearFile) {
      // Delete old file from storage
      if (resource.storageId) {
        await ctx.storage.delete(resource.storageId)
      }
      patch.storageId = undefined
      patch.fileName = undefined
    }

    if (clearEvent) {
      patch.eventId = undefined
    }

    await ctx.db.patch(id, patch)
  },
})

/**
 * Delete a resource and its stored file (admin).
 */
export const remove = mutation({
  args: { id: v.id('resources') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const resource = await ctx.db.get(args.id)
    if (!resource) throw new Error('Resource not found')

    if (resource.storageId) {
      await ctx.storage.delete(resource.storageId)
    }

    await ctx.db.delete(args.id)
  },
})

/**
 * Generate upload URL for resource files.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Get a URL for a stored resource file.
 */
export const getFileUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})
