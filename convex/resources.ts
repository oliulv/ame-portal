import { query, mutation } from './functions'
import { internal } from './_generated/api'
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
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

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
    topic: v.optional(v.string()),
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
      topic: args.topic,
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
    topic: v.optional(v.string()),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    storageId: v.optional(v.id('_storage')),
    fileName: v.optional(v.string()),
    eventId: v.optional(v.id('cohortEvents')),
    isActive: v.optional(v.boolean()),
    clearFile: v.optional(v.boolean()),
    clearEvent: v.optional(v.boolean()),
    clearTopic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const { id, clearFile, clearEvent, clearTopic, ...updates } = args
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

    if (clearTopic) {
      patch.topic = undefined
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
 * Generate upload URL for resource submission files (founder).
 */
export const generateSubmissionUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx)
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

/**
 * Reorder resources (admin). Accepts all resource IDs in desired order.
 */
export const reorder = mutation({
  args: { orderedIds: v.array(v.id('resources')) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { sortOrder: i })
    }
  },
})

/**
 * List all unique topic strings across resources.
 */
export const listTopics = query({
  args: {},
  handler: async (ctx) => {
    const resources = await ctx.db.query('resources').collect()
    const topics = [...new Set(resources.map((r) => r.topic).filter((t): t is string => !!t))]
    return topics.sort()
  },
})

// ── Resource Submissions ──────────────────────────────────────────

const categoryValidator = v.union(
  v.literal('video'),
  v.literal('podcast'),
  v.literal('book'),
  v.literal('other_reading')
)

/**
 * Submit a resource suggestion (authenticated founder).
 */
export const submitForApproval = mutation({
  args: {
    title: v.string(),
    category: categoryValidator,
    topic: v.optional(v.string()),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    storageId: v.optional(v.id('_storage')),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)
    const submissionId = await ctx.db.insert('resourceSubmissions', {
      title: args.title,
      category: args.category,
      topic: args.topic,
      description: args.description,
      url: args.url,
      storageId: args.storageId,
      fileName: args.fileName,
      submittedBy: user._id,
      status: 'pending',
    })

    // Notify admins about the new resource submission
    // Find the founder's cohort
    const founderProfile = await ctx.db
      .query('founderProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()
    if (founderProfile) {
      const startup = await ctx.db.get(founderProfile.startupId)
      if (startup) {
        await ctx.scheduler.runAfter(0, internal.notifications.notifyResourceSubmitted, {
          cohortId: startup.cohortId,
          founderName: user.fullName || founderProfile.fullName || 'A founder',
          resourceTitle: args.title,
        })
      }
    }

    return submissionId
  },
})

/**
 * List all resource submissions (admin).
 */
export const listSubmissions = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const submissions = await ctx.db.query('resourceSubmissions').collect()
    const enriched = await Promise.all(
      submissions.map(async (s) => {
        const user = await ctx.db.get(s.submittedBy)
        return { ...s, submitterName: user?.fullName ?? 'Unknown' }
      })
    )
    return enriched.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (a.status !== 'pending' && b.status === 'pending') return 1
      return b._creationTime - a._creationTime
    })
  },
})

/**
 * Count pending resource submissions (for dashboard).
 */
export const pendingSubmissionCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const submissions = await ctx.db.query('resourceSubmissions').collect()
    return submissions.filter((s) => s.status === 'pending').length
  },
})

/**
 * Review a resource submission — approve or reject (admin).
 */
export const reviewSubmission = mutation({
  args: {
    id: v.id('resourceSubmissions'),
    action: v.union(v.literal('approve'), v.literal('reject')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const submission = await ctx.db.get(args.id)
    if (!submission) throw new Error('Submission not found')
    if (submission.status !== 'pending') throw new Error('Submission already reviewed')

    if (args.action === 'approve') {
      const existing = await ctx.db.query('resources').collect()
      const sortOrder = existing.length
      await ctx.db.insert('resources', {
        title: submission.title,
        category: submission.category,
        topic: submission.topic,
        description: submission.description,
        url: submission.url,
        storageId: submission.storageId,
        fileName: submission.fileName,
        isActive: true,
        sortOrder,
      })
      await ctx.db.patch(args.id, { status: 'approved' })
    } else {
      await ctx.db.patch(args.id, { status: 'rejected' })
    }

    // Notify the founder who submitted
    await ctx.scheduler.runAfter(0, internal.notifications.notifyResourceReviewed, {
      userId: submission.submittedBy,
      resourceTitle: submission.title,
      status: args.action === 'approve' ? 'approved' : 'rejected',
    })
  },
})
