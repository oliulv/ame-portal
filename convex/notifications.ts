import { query, mutation, internalAction, internalQuery, internalMutation } from './functions'
import { internal } from './_generated/api'
import { v, ConvexError } from 'convex/values'
import { requireAuth } from './auth'
import type { Id } from './_generated/dataModel'
import { randomNumericCode, sha256Hex, timingSafeEqual } from './lib/random'
import { evaluateOtp, OTP_MAX_ATTEMPTS } from './lib/otp'

// ── Verification Flow ──────────────────────────────────────────

/**
 * Get the current user's SMS number and notification preferences.
 */
export const getMyPhone = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx)

    const smsRecord = await ctx.db
      .query('whatsappNumbers')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    const prefs = await ctx.db
      .query('notificationPreferences')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    return { smsRecord, preferences: prefs }
  },
})

/**
 * Get globally disabled notification types for the user's cohort(s).
 * Returns a Set-like array of disabled type keys.
 */
export const getDisabledNotificationTypes = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx)

    // Find cohort IDs the user belongs to
    const cohortIds: Id<'cohorts'>[] = []

    if (user.role === 'founder') {
      const profiles = await ctx.db
        .query('founderProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', user._id))
        .collect()
      for (const p of profiles) {
        const startup = await ctx.db.get(p.startupId)
        if (startup) cohortIds.push(startup.cohortId)
      }
    } else {
      // Admin — get assigned cohorts
      const assignments = await ctx.db
        .query('adminCohorts')
        .withIndex('by_userId', (q) => q.eq('userId', user._id))
        .collect()
      cohortIds.push(...assignments.map((a) => a.cohortId))
    }

    // Collect all disabled types across the user's cohorts
    const disabled = new Set<string>()
    for (const cohortId of cohortIds) {
      const settings = await ctx.db
        .query('notificationSettings')
        .withIndex('by_cohortId', (q) => q.eq('cohortId', cohortId))
        .collect()
      for (const s of settings) {
        if (!s.enabled) disabled.add(s.notificationType)
      }
    }

    return [...disabled]
  },
})

/**
 * Request OTP verification for a SMS number.
 * Creates/updates the phone number record and sends OTP via SMS.
 */
export const requestVerification = mutation({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    // Validate E.164 format
    if (!/^\+[1-9]\d{6,14}$/.test(args.phone)) {
      throw new ConvexError('Phone number must be in international format (e.g. +447700900000)')
    }

    // Check if phone is already verified by another user
    const existingForPhone = await ctx.db
      .query('whatsappNumbers')
      .withIndex('by_phone', (q) => q.eq('phone', args.phone))
      .first()
    if (existingForPhone && existingForPhone.userId !== user._id && existingForPhone.isVerified) {
      throw new ConvexError('This phone number is already linked to another account')
    }

    // Upsert phone number record (unverified)
    const existing = await ctx.db
      .query('whatsappNumbers')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    // Rate limit: 60 second cooldown between OTP requests
    if (existing?.lastOtpRequestedAt) {
      const elapsed = Date.now() - new Date(existing.lastOtpRequestedAt).getTime()
      if (elapsed < 60_000) {
        const remaining = Math.ceil((60_000 - elapsed) / 1000)
        throw new ConvexError(`Please wait ${remaining}s before requesting another code`)
      }
    }

    // Generate 6-digit OTP via CSPRNG. Only the hash is persisted.
    const otpCode = randomNumericCode(6)
    const otpCodeHash = await sha256Hex(otpCode)
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

    if (existing) {
      await ctx.db.patch(existing._id, {
        phone: args.phone,
        isVerified: false,
        verifiedAt: undefined,
        lastOtpRequestedAt: new Date().toISOString(),
        otpCode: undefined,
        otpCodeHash,
        otpAttempts: 0,
        otpExpiresAt,
      })
    } else {
      await ctx.db.insert('whatsappNumbers', {
        userId: user._id,
        phone: args.phone,
        isVerified: false,
        notificationsEnabled: true,
        lastOtpRequestedAt: new Date().toISOString(),
        otpCodeHash,
        otpAttempts: 0,
        otpExpiresAt,
      })
    }

    // Send OTP via SMS
    await ctx.scheduler.runAfter(0, internal.notifications.sendOtpMessage, {
      phone: args.phone,
      code: otpCode,
    })
  },
})

/**
 * Confirm OTP verification code — checked synchronously in this mutation.
 */
export const confirmVerification = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    const smsRecord = await ctx.db
      .query('whatsappNumbers')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (!smsRecord) {
      throw new ConvexError('No SMS number found. Please enter your number first.')
    }

    if (smsRecord.isVerified) {
      throw new ConvexError('Number is already verified.')
    }

    const candidateHash = await sha256Hex(args.code)

    // Prefer the hash; fall back to legacy plaintext column for rows written
    // before the OTP hash rollout. Legacy rows get migrated on first use by
    // just proceeding with the plaintext comparison once, then clearing it.
    const effectiveHash =
      smsRecord.otpCodeHash ?? (smsRecord.otpCode ? await sha256Hex(smsRecord.otpCode) : undefined)

    const decision = evaluateOtp(
      {
        otpCodeHash: effectiveHash,
        otpExpiresAt: smsRecord.otpExpiresAt,
        otpAttempts: smsRecord.otpAttempts,
      },
      candidateHash,
      new Date()
    )

    if (!decision.ok) {
      if (decision.reason === 'none') {
        throw new ConvexError('No verification code pending. Please request a new one.')
      }
      if (decision.reason === 'expired') {
        throw new ConvexError('Verification code has expired. Please request a new one.')
      }
      if (decision.reason === 'locked') {
        throw new ConvexError('Too many incorrect attempts. Please request a new code.')
      }
      // wrong — increment, and invalidate on the Nth miss
      const invalidate = decision.attempts >= OTP_MAX_ATTEMPTS
      await ctx.db.patch(smsRecord._id, {
        otpAttempts: decision.attempts,
        ...(invalidate
          ? { otpCodeHash: undefined, otpCode: undefined, otpExpiresAt: undefined }
          : {}),
      })
      throw new ConvexError('Incorrect verification code.')
    }

    // Extra constant-time belt for the match path — evaluateOtp already
    // confirmed equality, but this keeps the compare out of JS string ops.
    if (effectiveHash && !timingSafeEqual(effectiveHash, candidateHash)) {
      throw new ConvexError('Incorrect verification code.')
    }

    // Code is correct — mark as verified, clear all OTP state
    await ctx.db.patch(smsRecord._id, {
      isVerified: true,
      verifiedAt: new Date().toISOString(),
      otpCode: undefined,
      otpCodeHash: undefined,
      otpAttempts: undefined,
      otpExpiresAt: undefined,
    })

    // Create default notification preferences if they don't exist
    const prefs = await ctx.db
      .query('notificationPreferences')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (!prefs) {
      await ctx.db.insert('notificationPreferences', {
        userId: user._id,
        invoiceSubmitted: true,
        invoiceStatusChanged: true,
        milestoneSubmitted: true,
        milestoneStatusChanged: true,
        announcements: true,
        eventReminders: true,
      })
    }
  },
})

/**
 * Update notification preferences.
 */
export const updatePreferences = mutation({
  args: {
    invoiceSubmitted: v.optional(v.boolean()),
    invoiceStatusChanged: v.optional(v.boolean()),
    milestoneSubmitted: v.optional(v.boolean()),
    milestoneStatusChanged: v.optional(v.boolean()),
    announcements: v.optional(v.boolean()),
    eventReminders: v.optional(v.boolean()),
    invoicePaid: v.optional(v.boolean()),
    milestoneCreated: v.optional(v.boolean()),
    eventCreated: v.optional(v.boolean()),
    resourceSubmitted: v.optional(v.boolean()),
    resourceReviewed: v.optional(v.boolean()),
    onboardingCompleted: v.optional(v.boolean()),
    invitationAccepted: v.optional(v.boolean()),
    perkClaimed: v.optional(v.boolean()),
    milestoneWithdrawn: v.optional(v.boolean()),
    milestoneDeleted: v.optional(v.boolean()),
    eventUpdated: v.optional(v.boolean()),
    eventCancelled: v.optional(v.boolean()),
    bankDetailsAdded: v.optional(v.boolean()),
    perkCreated: v.optional(v.boolean()),
    founderRemoved: v.optional(v.boolean()),
    weeklyUpdateSubmitted: v.optional(v.boolean()),
    weeklyUpdateFavorited: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    const existing = await ctx.db
      .query('notificationPreferences')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    const defaults = {
      invoiceSubmitted: true,
      invoiceStatusChanged: true,
      milestoneSubmitted: true,
      milestoneStatusChanged: true,
      announcements: true,
      eventReminders: true,
    }

    if (existing) {
      const patch: Record<string, boolean> = {}
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined) patch[key] = value
      }
      await ctx.db.patch(existing._id, patch)
    } else {
      await ctx.db.insert('notificationPreferences', {
        userId: user._id,
        ...defaults,
        ...Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined)),
      })
    }
  },
})

/**
 * Toggle notifications on/off (master switch).
 */
export const toggleNotifications = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    const smsRecord = await ctx.db
      .query('whatsappNumbers')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (!smsRecord) {
      throw new Error('No phone number registered.')
    }

    await ctx.db.patch(smsRecord._id, { notificationsEnabled: args.enabled })
  },
})

/**
 * Remove SMS number (unlink).
 */
export const removeNumber = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx)

    const smsRecord = await ctx.db
      .query('whatsappNumbers')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (smsRecord) {
      await ctx.db.delete(smsRecord._id)
    }
  },
})

// ── Twilio REST helpers ────────────────────────────────────────

function twilioAuth() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) return null
  return {
    accountSid,
    authToken,
    basicAuth: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
  }
}

// ── Internal Actions (Twilio SMS) ──────────────────────────────

/**
 * Send OTP code via SMS.
 */
export const sendOtpMessage = internalAction({
  args: { phone: v.string(), code: v.string() },
  handler: async (_ctx, args) => {
    const auth = twilioAuth()
    const from = process.env.TWILIO_SMS_FROM
    if (!auth || !from) {
      console.log('Twilio credentials not configured, skipping OTP send')
      return
    }

    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${auth.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: auth.basicAuth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          Body: `Your Accelerate ME verification code is: ${args.code}`,
          From: from,
          To: args.phone,
        }),
      }
    )

    if (!resp.ok) {
      const data = await resp.json()
      throw new Error(`SMS send failed: ${data.message || resp.status}`)
    }
  },
})

// ── Notification Dispatch ──────────────────────────────────────

/**
 * Internal query: resolve recipients for a notification type within a cohort.
 * Returns list of { userId, phone } for users who have verified SMS
 * and have the given notification type enabled.
 */
export const resolveRecipients = internalQuery({
  args: {
    userIds: v.array(v.id('users')),
    notificationType: v.string(),
    cohortId: v.optional(v.id('cohorts')),
  },
  handler: async (ctx, args) => {
    // Check global cohort-level toggle first
    if (args.cohortId) {
      const globalSetting = await ctx.db
        .query('notificationSettings')
        .withIndex('by_cohortId_type', (q) =>
          q.eq('cohortId', args.cohortId!).eq('notificationType', args.notificationType)
        )
        .first()
      if (globalSetting && globalSetting.enabled === false) return []
    }

    const recipients: { userId: Id<'users'>; phone: string }[] = []

    for (const userId of args.userIds) {
      const smsRecord = await ctx.db
        .query('whatsappNumbers')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .first()

      if (!smsRecord?.isVerified || !smsRecord.notificationsEnabled) continue

      const prefs = await ctx.db
        .query('notificationPreferences')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .first()

      // Default to enabled if no preferences exist
      if (prefs) {
        const prefKey = args.notificationType as keyof typeof prefs
        if (prefKey in prefs && prefs[prefKey] === false) continue
      }

      recipients.push({ userId, phone: smsRecord.phone })
    }

    return recipients
  },
})

/**
 * Internal query: get all admin user IDs with a specific permission for a cohort.
 * Super admins are always included.
 */
export const getAdminsWithPermission = internalQuery({
  args: {
    cohortId: v.id('cohorts'),
    permission: v.string(),
  },
  handler: async (ctx, args) => {
    // Get admins assigned to this cohort
    const cohortAssignments = await ctx.db
      .query('adminCohorts')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()
    const assignedAdminIds = cohortAssignments.map((a) => a.userId)

    // From those, find ones with the specific permission
    const withPermission: Id<'users'>[] = []
    for (const userId of assignedAdminIds) {
      const perm = await ctx.db
        .query('adminPermissions')
        .withIndex('by_userId_cohortId_permission', (q) =>
          q
            .eq('userId', userId)
            .eq('cohortId', args.cohortId)
            .eq('permission', args.permission as 'approve_milestones' | 'approve_invoices')
        )
        .first()
      if (perm) withPermission.push(userId)
    }

    // Super admins always get notifications — find them among users who have any admin role
    // Use the cohort assignments to find users, then check their role
    const superAdminIds: Id<'users'>[] = []
    const allAdminIds = new Set(assignedAdminIds)
    for (const userId of allAdminIds) {
      const user = await ctx.db.get(userId)
      if (user?.role === 'super_admin') superAdminIds.push(userId)
    }

    // Also include super admins not assigned to this cohort
    // (they should receive all notifications)
    const allUsers = await ctx.db.query('users').collect()
    for (const user of allUsers) {
      if (user.role === 'super_admin' && !allAdminIds.has(user._id)) {
        superAdminIds.push(user._id)
      }
    }

    // Deduplicate
    const allIds = [...new Set([...superAdminIds, ...withPermission])]
    return allIds
  },
})

/**
 * Internal query: get all founder user IDs in a cohort.
 */
export const getFounderUserIdsInCohort = internalQuery({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    const startups = await ctx.db
      .query('startups')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const founderIds: Id<'users'>[] = []
    for (const startup of startups) {
      const profiles = await ctx.db
        .query('founderProfiles')
        .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
        .collect()
      founderIds.push(...profiles.map((p) => p.userId))
    }

    return founderIds
  },
})

/**
 * Internal action: send an SMS notification and log the result.
 */
export const sendSmsMessage = internalAction({
  args: {
    userId: v.id('users'),
    phone: v.string(),
    message: v.string(),
    type: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const auth = twilioAuth()
    const from = process.env.TWILIO_SMS_FROM

    if (!auth || !from) {
      console.log('Twilio credentials not configured, skipping SMS send')
      await ctx.runMutation(internal.notifications.logNotification, {
        userId: args.userId,
        type: args.type,
        status: 'skipped',
        error: 'Twilio credentials not configured',
        metadata: args.metadata,
      })
      return
    }

    try {
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${auth.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: auth.basicAuth,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            Body: args.message,
            From: from,
            To: args.phone,
          }),
        }
      )

      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.message || `Twilio API error: ${resp.status}`)
      }

      await ctx.runMutation(internal.notifications.logNotification, {
        userId: args.userId,
        type: args.type,
        status: 'sent',
        twilioMessageSid: data.sid,
        metadata: args.metadata,
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('SMS send failed:', errorMsg)

      await ctx.runMutation(internal.notifications.logNotification, {
        userId: args.userId,
        type: args.type,
        status: 'failed',
        error: errorMsg,
        metadata: args.metadata,
      })
    }
  },
})

/**
 * Internal mutation: log a notification attempt.
 */
export const logNotification = internalMutation({
  args: {
    userId: v.id('users'),
    type: v.string(),
    status: v.union(v.literal('sent'), v.literal('failed'), v.literal('skipped')),
    twilioMessageSid: v.optional(v.string()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('notificationLog', {
      userId: args.userId,
      type: args.type,
      status: args.status,
      twilioMessageSid: args.twilioMessageSid,
      error: args.error,
      metadata: args.metadata,
    })
  },
})

// ── Notification Trigger Actions ───────────────────────────────

/**
 * Notify admins when a new invoice is submitted.
 */
export const notifyInvoiceSubmitted = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    startupName: v.string(),
    vendorName: v.string(),
    amountGbp: v.number(),
  },
  handler: async (ctx, args) => {
    const adminIds = await ctx.runQuery(internal.notifications.getAdminsWithPermission, {
      cohortId: args.cohortId,
      permission: 'approve_invoices',
    })

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: adminIds,
      notificationType: 'invoiceSubmitted',
      cohortId: args.cohortId,
    })

    const message = `New invoice from ${args.startupName}: ${args.vendorName} — £${args.amountGbp.toFixed(2)}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'invoiceSubmitted',

        metadata: {
          startupName: args.startupName,
          vendorName: args.vendorName,
          amountGbp: args.amountGbp,
        },
      })
    }
  },
})

/**
 * Notify founder when their invoice status changes.
 */
export const notifyInvoiceStatusChanged = internalAction({
  args: {
    userId: v.id('users'),
    fileName: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: [args.userId],
      notificationType: 'invoiceStatusChanged',
    })

    if (recipients.length === 0) return

    const message = `Your invoice ${args.fileName} has been ${args.status}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'invoiceStatusChanged',

        metadata: { fileName: args.fileName, status: args.status },
      })
    }
  },
})

/**
 * Notify admins when a milestone is submitted.
 */
export const notifyMilestoneSubmitted = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    startupName: v.string(),
    milestoneTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const adminIds = await ctx.runQuery(internal.notifications.getAdminsWithPermission, {
      cohortId: args.cohortId,
      permission: 'approve_milestones',
    })

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: adminIds,
      notificationType: 'milestoneSubmitted',
      cohortId: args.cohortId,
    })

    const message = `New milestone submitted: ${args.milestoneTitle} from ${args.startupName}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'milestoneSubmitted',

        metadata: {
          startupName: args.startupName,
          milestoneTitle: args.milestoneTitle,
        },
      })
    }
  },
})

/**
 * Notify founder when their milestone status changes.
 */
export const notifyMilestoneStatusChanged = internalAction({
  args: {
    userId: v.id('users'),
    milestoneTitle: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: [args.userId],
      notificationType: 'milestoneStatusChanged',
    })

    if (recipients.length === 0) return

    const statusLabel = args.status === 'changes_requested' ? 'sent back for changes' : args.status
    const message = `Your milestone "${args.milestoneTitle}" has been ${statusLabel}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'milestoneStatusChanged',

        metadata: {
          milestoneTitle: args.milestoneTitle,
          status: args.status,
        },
      })
    }
  },
})

/**
 * Send daily event reminders (called by cron).
 */
export const sendDailyEventReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    // Get all events happening today
    const todayEvents = await ctx.runQuery(internal.notifications.getEventsForDate, { date: today })

    for (const event of todayEvents) {
      const founderIds = await ctx.runQuery(internal.notifications.getFounderUserIdsInCohort, {
        cohortId: event.cohortId,
      })

      const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
        userIds: founderIds,
        notificationType: 'eventReminders',
      })

      const message = `Reminder: ${event.title} is today`

      for (const r of recipients) {
        await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
          userId: r.userId,
          phone: r.phone,
          message,
          type: 'eventReminder',

          metadata: {
            eventTitle: event.title,
            date: today,
          },
        })
      }
    }
  },
})

/**
 * Internal query: get all admin user IDs for a cohort (assigned + super admins).
 */
export const getAdminUserIdsForCohort = internalQuery({
  args: { cohortId: v.id('cohorts') },
  handler: async (ctx, args) => {
    // Admins assigned to this cohort
    const cohortAssignments = await ctx.db
      .query('adminCohorts')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()
    const assignedIds = new Set(cohortAssignments.map((a) => a.userId))

    // All super admins (they see all cohorts)
    const allUsers = await ctx.db.query('users').collect()
    for (const user of allUsers) {
      if (user.role === 'super_admin') assignedIds.add(user._id)
    }

    return [...assignedIds]
  },
})

/**
 * Internal query: get events for a specific date.
 */
export const getEventsForDate = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const allEvents = await ctx.db.query('cohortEvents').collect()
    return allEvents.filter((e) => e.isActive && e.date.startsWith(args.date))
  },
})

/**
 * Send announcement to all founders and admins in a cohort.
 */
export const sendAnnouncementNotification = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    // Get founders in cohort
    const founderIds = await ctx.runQuery(internal.notifications.getFounderUserIdsInCohort, {
      cohortId: args.cohortId,
    })

    // Get all admins for this cohort (assigned admins + super admins)
    const adminIds = await ctx.runQuery(internal.notifications.getAdminUserIdsForCohort, {
      cohortId: args.cohortId,
    })

    // Deduplicate (in case an admin is also a founder)
    const allUserIds = [...new Set([...founderIds, ...adminIds])]

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: allUserIds,
      notificationType: 'announcements',
      cohortId: args.cohortId,
    })

    const message = `${args.title}: ${args.body}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'announcement',
        metadata: { title: args.title },
      })
    }
  },
})

// ── New Notification Triggers ────────────────────────────────

/**
 * Notify founder when their invoice is marked as paid.
 */
export const notifyInvoicePaid = internalAction({
  args: {
    userId: v.id('users'),
    fileName: v.string(),
    amountGbp: v.number(),
    cohortId: v.optional(v.id('cohorts')),
  },
  handler: async (ctx, args) => {
    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: [args.userId],
      notificationType: 'invoicePaid',
      cohortId: args.cohortId,
    })

    if (recipients.length === 0) return

    const message = `Your invoice ${args.fileName} (£${args.amountGbp.toFixed(2)}) has been marked as paid`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'invoicePaid',
        metadata: { fileName: args.fileName, amountGbp: args.amountGbp },
      })
    }
  },
})

/**
 * Notify founders when admin creates a new milestone for their startup.
 */
export const notifyMilestoneCreated = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    startupId: v.id('startups'),
    milestoneTitle: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const founderProfiles = await ctx.runQuery(internal.notifications.getFoundersForStartup, {
      startupId: args.startupId,
    })

    if (founderProfiles.length === 0) return

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: founderProfiles,
      notificationType: 'milestoneCreated',
      cohortId: args.cohortId,
    })

    const message = `New milestone: "${args.milestoneTitle}" (£${args.amount.toLocaleString()}) has been added to your startup`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'milestoneCreated',
        metadata: { milestoneTitle: args.milestoneTitle, amount: args.amount },
      })
    }
  },
})

/**
 * Notify founders when a new event is created for their cohort.
 */
export const notifyEventCreated = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    eventTitle: v.string(),
    eventDate: v.string(),
  },
  handler: async (ctx, args) => {
    const founderIds = await ctx.runQuery(internal.notifications.getFounderUserIdsInCohort, {
      cohortId: args.cohortId,
    })

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: founderIds,
      notificationType: 'eventCreated',
      cohortId: args.cohortId,
    })

    const message = `New event: "${args.eventTitle}" on ${args.eventDate}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'eventCreated',
        metadata: { eventTitle: args.eventTitle, eventDate: args.eventDate },
      })
    }
  },
})

/**
 * Notify admins when a founder submits a resource for review.
 */
export const notifyResourceSubmitted = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    founderName: v.string(),
    resourceTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const adminIds = await ctx.runQuery(internal.notifications.getAdminUserIdsForCohort, {
      cohortId: args.cohortId,
    })

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: adminIds,
      notificationType: 'resourceSubmitted',
      cohortId: args.cohortId,
    })

    const message = `${args.founderName} submitted a resource for review: "${args.resourceTitle}"`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'resourceSubmitted',
        metadata: { founderName: args.founderName, resourceTitle: args.resourceTitle },
      })
    }
  },
})

/**
 * Notify founder when their resource submission is reviewed.
 */
export const notifyResourceReviewed = internalAction({
  args: {
    userId: v.id('users'),
    resourceTitle: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: [args.userId],
      notificationType: 'resourceReviewed',
    })

    if (recipients.length === 0) return

    const message = `Your resource "${args.resourceTitle}" has been ${args.status}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'resourceReviewed',
        metadata: { resourceTitle: args.resourceTitle, status: args.status },
      })
    }
  },
})

/**
 * Notify admins when a founder completes onboarding.
 */
export const notifyOnboardingCompleted = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    founderName: v.string(),
    startupName: v.string(),
  },
  handler: async (ctx, args) => {
    const adminIds = await ctx.runQuery(internal.notifications.getAdminUserIdsForCohort, {
      cohortId: args.cohortId,
    })

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: adminIds,
      notificationType: 'onboardingCompleted',
      cohortId: args.cohortId,
    })

    const message = `${args.founderName} from ${args.startupName} has completed onboarding`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'onboardingCompleted',
        metadata: { founderName: args.founderName, startupName: args.startupName },
      })
    }
  },
})

/**
 * Notify admins when a founder accepts an invitation.
 */
export const notifyInvitationAccepted = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    founderName: v.string(),
    startupName: v.string(),
  },
  handler: async (ctx, args) => {
    const adminIds = await ctx.runQuery(internal.notifications.getAdminUserIdsForCohort, {
      cohortId: args.cohortId,
    })

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: adminIds,
      notificationType: 'invitationAccepted',
      cohortId: args.cohortId,
    })

    const message = `${args.founderName} has accepted their invitation and joined ${args.startupName}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'invitationAccepted',
        metadata: { founderName: args.founderName, startupName: args.startupName },
      })
    }
  },
})

/**
 * Notify admins when a founder claims a perk.
 */
export const notifyPerkClaimed = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    founderName: v.string(),
    perkTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const adminIds = await ctx.runQuery(internal.notifications.getAdminUserIdsForCohort, {
      cohortId: args.cohortId,
    })

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: adminIds,
      notificationType: 'perkClaimed',
      cohortId: args.cohortId,
    })

    const message = `${args.founderName} claimed a perk: "${args.perkTitle}"`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'perkClaimed',
        metadata: { founderName: args.founderName, perkTitle: args.perkTitle },
      })
    }
  },
})

/**
 * Internal query: get founder user IDs for a specific startup.
 */
export const getFoundersForStartup = internalQuery({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    const profiles = await ctx.db
      .query('founderProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()
    return profiles.map((p) => p.userId)
  },
})

/**
 * Notify admins when a founder withdraws a submitted milestone.
 */
export const notifyMilestoneWithdrawn = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    startupName: v.string(),
    milestoneTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const adminIds = await ctx.runQuery(internal.notifications.getAdminsWithPermission, {
      cohortId: args.cohortId,
      permission: 'approve_milestones',
    })

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: adminIds,
      notificationType: 'milestoneWithdrawn',
      cohortId: args.cohortId,
    })

    const message = `${args.startupName} withdrew milestone: "${args.milestoneTitle}"`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'milestoneWithdrawn',
        metadata: { startupName: args.startupName, milestoneTitle: args.milestoneTitle },
      })
    }
  },
})

/**
 * Notify founders when an admin deletes a milestone from their startup.
 */
export const notifyMilestoneDeleted = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    startupId: v.id('startups'),
    milestoneTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const founderIds = await ctx.runQuery(internal.notifications.getFoundersForStartup, {
      startupId: args.startupId,
    })

    if (founderIds.length === 0) return

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: founderIds,
      notificationType: 'milestoneDeleted',
      cohortId: args.cohortId,
    })

    const message = `Milestone "${args.milestoneTitle}" has been removed from your startup`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'milestoneDeleted',
        metadata: { milestoneTitle: args.milestoneTitle },
      })
    }
  },
})

/**
 * Notify founders when an event is updated.
 */
export const notifyEventUpdated = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    eventTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const founderIds = await ctx.runQuery(internal.notifications.getFounderUserIdsInCohort, {
      cohortId: args.cohortId,
    })

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: founderIds,
      notificationType: 'eventUpdated',
      cohortId: args.cohortId,
    })

    const message = `Event updated: "${args.eventTitle}"`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'eventUpdated',
        metadata: { eventTitle: args.eventTitle },
      })
    }
  },
})

/**
 * Notify founders when an event is cancelled/deactivated.
 */
export const notifyEventCancelled = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    eventTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const founderIds = await ctx.runQuery(internal.notifications.getFounderUserIdsInCohort, {
      cohortId: args.cohortId,
    })

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: founderIds,
      notificationType: 'eventCancelled',
      cohortId: args.cohortId,
    })

    const message = `Event cancelled: "${args.eventTitle}"`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'eventCancelled',
        metadata: { eventTitle: args.eventTitle },
      })
    }
  },
})

/**
 * Notify admins when a founder adds bank details.
 */
export const notifyBankDetailsAdded = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    founderName: v.string(),
    startupName: v.string(),
  },
  handler: async (ctx, args) => {
    const adminIds = await ctx.runQuery(internal.notifications.getAdminUserIdsForCohort, {
      cohortId: args.cohortId,
    })

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: adminIds,
      notificationType: 'bankDetailsAdded',
      cohortId: args.cohortId,
    })

    const message = `${args.founderName} from ${args.startupName} has added bank details`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'bankDetailsAdded',
        metadata: { founderName: args.founderName, startupName: args.startupName },
      })
    }
  },
})

/**
 * Notify founders when an admin creates a new perk.
 */
export const notifyPerkCreated = internalAction({
  args: {
    perkTitle: v.string(),
  },
  handler: async (ctx, args) => {
    // Perks are global — notify founders in all active cohorts
    const allCohorts = await ctx.runQuery(internal.notifications.getAllActiveCohorts, {})

    for (const cohort of allCohorts) {
      const founderIds = await ctx.runQuery(internal.notifications.getFounderUserIdsInCohort, {
        cohortId: cohort._id,
      })

      const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
        userIds: founderIds,
        notificationType: 'perkCreated',
        cohortId: cohort._id,
      })

      const message = `New perk available: "${args.perkTitle}"`

      for (const r of recipients) {
        await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
          userId: r.userId,
          phone: r.phone,
          message,
          type: 'perkCreated',
          metadata: { perkTitle: args.perkTitle },
        })
      }
    }
  },
})

/**
 * Notify a founder when they are removed from a startup.
 */
export const notifyFounderRemoved = internalAction({
  args: {
    userId: v.id('users'),
    startupName: v.string(),
  },
  handler: async (ctx, args) => {
    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: [args.userId],
      notificationType: 'founderRemoved',
    })

    if (recipients.length === 0) return

    const message = `You have been removed from ${args.startupName}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'founderRemoved',
        metadata: { startupName: args.startupName },
      })
    }
  },
})

/**
 * Notify admins when a founder submits a weekly update.
 */
export const notifyWeeklyUpdateSubmitted = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    startupName: v.string(),
  },
  handler: async (ctx, args) => {
    const adminIds = await ctx.runQuery(internal.notifications.getAdminUserIdsForCohort, {
      cohortId: args.cohortId,
    })

    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: adminIds,
      notificationType: 'weeklyUpdateSubmitted',
      cohortId: args.cohortId,
    })

    const message = `${args.startupName} submitted their weekly update`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'weeklyUpdateSubmitted',
        metadata: { startupName: args.startupName },
      })
    }
  },
})

/**
 * Notify founder when their weekly update is favorited.
 */
export const notifyWeeklyUpdateFavorited = internalAction({
  args: {
    founderId: v.id('users'),
    startupName: v.string(),
    weekOf: v.string(),
    cohortId: v.optional(v.id('cohorts')),
  },
  handler: async (ctx, args) => {
    const recipients = await ctx.runQuery(internal.notifications.resolveRecipients, {
      userIds: [args.founderId],
      notificationType: 'weeklyUpdateFavorited',
      cohortId: args.cohortId,
    })

    if (recipients.length === 0) return

    const message = `Your weekly update for ${args.startupName} was marked as a favourite!`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'weeklyUpdateFavorited',
        metadata: { startupName: args.startupName, weekOf: args.weekOf },
      })
    }
  },
})

/**
 * Internal query: get all active cohorts.
 */
export const getAllActiveCohorts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cohorts = await ctx.db.query('cohorts').collect()
    return cohorts.filter((c) => c.isActive)
  },
})
