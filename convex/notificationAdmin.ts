import { query, mutation } from './functions'
import { v } from 'convex/values'
import { requireAdminWithPermission } from './auth'
import { NOTIFICATION_TYPES } from './lib/notificationTypes'

/**
 * Get aggregated notification stats for a cohort.
 * Returns totals + per-type breakdown + daily time series (last 30 days).
 */
export const getNotificationStats = query({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    await requireAdminWithPermission(ctx, args.cohortId, 'send_announcements')

    // Get all users in this cohort (founders + admins)
    const startups = await ctx.db
      .query('startups')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const founderIds: Set<string> = new Set()
    for (const startup of startups) {
      const profiles = await ctx.db
        .query('founderProfiles')
        .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
        .collect()
      profiles.forEach((p) => founderIds.add(p.userId))
    }

    const adminAssignments = await ctx.db
      .query('adminCohorts')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()
    const adminIds = new Set(adminAssignments.map((a) => a.userId))

    // All super admins
    const allUsers = await ctx.db.query('users').collect()
    for (const user of allUsers) {
      if (user.role === 'super_admin') adminIds.add(user._id)
    }

    const cohortUserIds = new Set([...founderIds, ...adminIds])

    // Fetch all notification logs for cohort users
    const logs = []
    for (const userId of cohortUserIds) {
      const userLogs = await ctx.db
        .query('notificationLog')
        .withIndex('by_userId', (q) => q.eq('userId', userId as any))
        .collect()
      logs.push(...userLogs)
    }

    // Totals
    let totalSent = 0
    let totalFailed = 0
    let totalSkipped = 0

    // Per-type breakdown
    const perType: Record<string, { sent: number; failed: number; skipped: number }> = {}
    for (const t of NOTIFICATION_TYPES) {
      perType[t.key] = { sent: 0, failed: 0, skipped: 0 }
    }

    // Daily time series (last 30 days)
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const dailySeries: Record<string, { sent: number; failed: number }> = {}

    for (const log of logs) {
      if (log.status === 'sent') totalSent++
      else if (log.status === 'failed') totalFailed++
      else if (log.status === 'skipped') totalSkipped++

      if (perType[log.type]) {
        perType[log.type][log.status]++
      }

      // Time series
      if (log._creationTime >= thirtyDaysAgo) {
        const day = new Date(log._creationTime).toISOString().split('T')[0]
        if (!dailySeries[day]) dailySeries[day] = { sent: 0, failed: 0 }
        if (log.status === 'sent') dailySeries[day].sent++
        else if (log.status === 'failed') dailySeries[day].failed++
      }
    }

    // Fill in missing days
    const timeSeriesArray = []
    for (let d = new Date(thirtyDaysAgo); d.getTime() <= now; d.setDate(d.getDate() + 1)) {
      const day = d.toISOString().split('T')[0]
      timeSeriesArray.push({
        date: day,
        sent: dailySeries[day]?.sent ?? 0,
        failed: dailySeries[day]?.failed ?? 0,
      })
    }

    return {
      totals: { sent: totalSent, failed: totalFailed, skipped: totalSkipped },
      perType,
      timeSeries: timeSeriesArray,
    }
  },
})

/**
 * Get global notification settings for a cohort.
 * Returns { [type]: boolean } with defaults true (opt-out model).
 */
export const getGlobalSettings = query({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    await requireAdminWithPermission(ctx, args.cohortId, 'send_announcements')

    const settings = await ctx.db
      .query('notificationSettings')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const result: Record<string, boolean> = {}
    for (const t of NOTIFICATION_TYPES) {
      result[t.key] = true // default enabled
    }
    for (const s of settings) {
      result[s.notificationType] = s.enabled
    }

    return result
  },
})

/**
 * Get all users in a cohort with their SMS verification status,
 * master switch, and per-type preferences.
 */
export const getUserNotificationStatus = query({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    await requireAdminWithPermission(ctx, args.cohortId, 'send_announcements')

    // Get founders
    const startups = await ctx.db
      .query('startups')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const founders: {
      userId: string
      name: string
      role: 'founder'
      phone: string | null
      isVerified: boolean
      notificationsEnabled: boolean
      enabledPreferenceCount: number
    }[] = []

    for (const startup of startups) {
      const profiles = await ctx.db
        .query('founderProfiles')
        .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
        .collect()

      for (const fp of profiles) {
        const user = await ctx.db.get(fp.userId)
        if (!user) continue

        const smsRecord = await ctx.db
          .query('whatsappNumbers')
          .withIndex('by_userId', (q) => q.eq('userId', fp.userId))
          .first()

        const prefs = await ctx.db
          .query('notificationPreferences')
          .withIndex('by_userId', (q) => q.eq('userId', fp.userId))
          .first()

        let enabledCount = 0
        if (prefs) {
          for (const [key, value] of Object.entries(prefs)) {
            if (key === '_id' || key === '_creationTime' || key === 'userId') continue
            if (value === true || value === undefined) enabledCount++
          }
        }

        founders.push({
          userId: fp.userId,
          name: fp.fullName || user.fullName || user.email || 'Unknown',
          role: 'founder',
          phone: smsRecord?.phone ?? null,
          isVerified: smsRecord?.isVerified ?? false,
          notificationsEnabled: smsRecord?.notificationsEnabled ?? false,
          enabledPreferenceCount: enabledCount,
        })
      }
    }

    // Get admins
    const adminAssignments = await ctx.db
      .query('adminCohorts')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()
    const adminUserIds = new Set(adminAssignments.map((a) => a.userId))

    const allUsers = await ctx.db.query('users').collect()
    for (const user of allUsers) {
      if (user.role === 'super_admin') adminUserIds.add(user._id)
    }

    const admins: typeof founders = []
    for (const adminId of adminUserIds) {
      const user = await ctx.db.get(adminId)
      if (!user) continue

      const smsRecord = await ctx.db
        .query('whatsappNumbers')
        .withIndex('by_userId', (q) => q.eq('userId', adminId))
        .first()

      const prefs = await ctx.db
        .query('notificationPreferences')
        .withIndex('by_userId', (q) => q.eq('userId', adminId))
        .first()

      let enabledCount = 0
      if (prefs) {
        for (const [key, value] of Object.entries(prefs)) {
          if (key === '_id' || key === '_creationTime' || key === 'userId') continue
          if (value === true || value === undefined) enabledCount++
        }
      }

      admins.push({
        userId: adminId,
        name: user.fullName || user.email || 'Unknown',
        role: 'founder', // type hack - will override below
        phone: smsRecord?.phone ?? null,
        isVerified: smsRecord?.isVerified ?? false,
        notificationsEnabled: smsRecord?.notificationsEnabled ?? false,
        enabledPreferenceCount: enabledCount,
      })
    }

    // Sort: admins first, then founders, alphabetical within
    const sortedAdmins = admins.sort((a, b) => a.name.localeCompare(b.name))
    const sortedFounders = founders.sort((a, b) => a.name.localeCompare(b.name))

    const smsEnabledCount = [...sortedAdmins, ...sortedFounders].filter(
      (u) => u.isVerified && u.notificationsEnabled
    ).length
    const totalCount = sortedAdmins.length + sortedFounders.length

    return {
      admins: sortedAdmins.map((a) => ({ ...a, role: 'admin' as const })),
      founders: sortedFounders,
      smsEnabledCount,
      totalCount,
    }
  },
})

/**
 * Set a global toggle for a notification type in a cohort.
 */
export const setGlobalToggle = mutation({
  args: {
    cohortId: v.id('cohorts'),
    notificationType: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdminWithPermission(ctx, args.cohortId, 'send_announcements')

    const existing = await ctx.db
      .query('notificationSettings')
      .withIndex('by_cohortId_type', (q) =>
        q.eq('cohortId', args.cohortId).eq('notificationType', args.notificationType)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled })
    } else {
      await ctx.db.insert('notificationSettings', {
        cohortId: args.cohortId,
        notificationType: args.notificationType,
        enabled: args.enabled,
      })
    }
  },
})
