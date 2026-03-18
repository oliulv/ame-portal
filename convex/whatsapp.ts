import { query, mutation, internalAction, internalQuery, internalMutation } from './functions'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireAuth } from './auth'
import type { Id } from './_generated/dataModel'

// ── Verification Flow ──────────────────────────────────────────

/**
 * Get the current user's WhatsApp number and notification preferences.
 */
export const getMyWhatsApp = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx)

    const whatsapp = await ctx.db
      .query('whatsappNumbers')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    const prefs = await ctx.db
      .query('notificationPreferences')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    return { whatsapp, preferences: prefs }
  },
})

/**
 * Request OTP verification for a WhatsApp number.
 * Creates/updates the whatsappNumbers record and sends OTP via Twilio Verify.
 */
export const requestVerification = mutation({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    // Validate E.164 format
    if (!/^\+[1-9]\d{6,14}$/.test(args.phone)) {
      throw new Error('Phone number must be in E.164 format (e.g. +447700900000)')
    }

    // Check if phone is already verified by another user
    const existingForPhone = await ctx.db
      .query('whatsappNumbers')
      .withIndex('by_phone', (q) => q.eq('phone', args.phone))
      .first()
    if (existingForPhone && existingForPhone.userId !== user._id && existingForPhone.isVerified) {
      throw new Error('This phone number is already registered to another account')
    }

    // Upsert whatsapp number record (unverified)
    const existing = await ctx.db
      .query('whatsappNumbers')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    // Rate limit: 60 second cooldown between OTP requests
    if (existing?.lastOtpRequestedAt) {
      const elapsed = Date.now() - new Date(existing.lastOtpRequestedAt).getTime()
      if (elapsed < 60_000) {
        throw new Error('Please wait before requesting another code')
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        phone: args.phone,
        isVerified: false,
        verifiedAt: undefined,
        lastOtpRequestedAt: new Date().toISOString(),
      })
    } else {
      await ctx.db.insert('whatsappNumbers', {
        userId: user._id,
        phone: args.phone,
        isVerified: false,
        notificationsEnabled: true,
        lastOtpRequestedAt: new Date().toISOString(),
      })
    }

    // Schedule the Twilio Verify send
    await ctx.scheduler.runAfter(0, internal.whatsapp.sendVerificationCode, {
      phone: args.phone,
      userId: user._id,
    })
  },
})

/**
 * Confirm OTP verification code.
 */
export const confirmVerification = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx)

    const whatsapp = await ctx.db
      .query('whatsappNumbers')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (!whatsapp) {
      throw new Error('No WhatsApp number found. Please enter your number first.')
    }

    if (whatsapp.isVerified) {
      throw new Error('Number is already verified.')
    }

    // Schedule the Twilio Verify check
    await ctx.scheduler.runAfter(0, internal.whatsapp.checkVerificationCode, {
      phone: whatsapp.phone,
      code: args.code,
      userId: user._id,
    })
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

    const whatsapp = await ctx.db
      .query('whatsappNumbers')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (!whatsapp) {
      throw new Error('No WhatsApp number registered.')
    }

    await ctx.db.patch(whatsapp._id, { notificationsEnabled: args.enabled })
  },
})

/**
 * Remove WhatsApp number (unlink).
 */
export const removeNumber = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx)

    const whatsapp = await ctx.db
      .query('whatsappNumbers')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (whatsapp) {
      await ctx.db.delete(whatsapp._id)
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

// ── Internal Actions (Twilio REST API) ─────────────────────────

/**
 * Send OTP via Twilio Verify (WhatsApp channel).
 */
export const sendVerificationCode = internalAction({
  args: { phone: v.string(), userId: v.id('users') },
  handler: async (_ctx, args) => {
    const auth = twilioAuth()
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID
    if (!auth || !serviceSid) {
      console.log('Twilio credentials not configured, skipping verification send')
      return
    }

    const resp = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`, {
      method: 'POST',
      headers: {
        Authorization: auth.basicAuth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: args.phone,
        Channel: 'whatsapp',
      }),
    })

    if (!resp.ok) {
      const error = await resp.text()
      throw new Error(`Twilio Verify send failed: ${error}`)
    }
  },
})

/**
 * Check OTP via Twilio Verify and mark as verified if correct.
 */
export const checkVerificationCode = internalAction({
  args: { phone: v.string(), code: v.string(), userId: v.id('users') },
  handler: async (ctx, args) => {
    const auth = twilioAuth()
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID
    if (!auth || !serviceSid) {
      console.log('Twilio credentials not configured, skipping verification check')
      return
    }

    const resp = await fetch(
      `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationChecks`,
      {
        method: 'POST',
        headers: {
          Authorization: auth.basicAuth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: args.phone,
          Code: args.code,
        }),
      }
    )

    if (!resp.ok) {
      const error = await resp.text()
      throw new Error(`Twilio Verify check failed: ${error}`)
    }

    const data = await resp.json()
    if (data.status === 'approved') {
      await ctx.runMutation(internal.whatsapp.markVerified, {
        userId: args.userId,
      })
    }
  },
})

/**
 * Internal mutation to mark a number as verified.
 */
export const markVerified = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const whatsapp = await ctx.db
      .query('whatsappNumbers')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first()

    if (whatsapp) {
      await ctx.db.patch(whatsapp._id, {
        isVerified: true,
        verifiedAt: new Date().toISOString(),
      })
    }

    // Create default notification preferences if they don't exist
    const prefs = await ctx.db
      .query('notificationPreferences')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first()

    if (!prefs) {
      await ctx.db.insert('notificationPreferences', {
        userId: args.userId,
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

// ── Notification Dispatch ──────────────────────────────────────

/**
 * Internal query: resolve recipients for a notification type within a cohort.
 * Returns list of { userId, phone } for users who have verified WhatsApp
 * and have the given notification type enabled.
 */
export const resolveRecipients = internalQuery({
  args: {
    userIds: v.array(v.id('users')),
    notificationType: v.string(),
  },
  handler: async (ctx, args) => {
    const recipients: { userId: Id<'users'>; phone: string }[] = []

    for (const userId of args.userIds) {
      const whatsapp = await ctx.db
        .query('whatsappNumbers')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .first()

      if (!whatsapp?.isVerified || !whatsapp.notificationsEnabled) continue

      const prefs = await ctx.db
        .query('notificationPreferences')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .first()

      // Default to enabled if no preferences exist
      if (prefs) {
        const prefKey = args.notificationType as keyof typeof prefs
        if (prefKey in prefs && prefs[prefKey] === false) continue
      }

      recipients.push({ userId, phone: whatsapp.phone })
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
 * Internal action: send a WhatsApp message and log the result.
 */
export const sendWhatsAppMessage = internalAction({
  args: {
    userId: v.id('users'),
    phone: v.string(),
    message: v.string(),
    type: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const auth = twilioAuth()
    const from = process.env.TWILIO_WHATSAPP_FROM

    if (!auth || !from) {
      console.log('Twilio credentials not configured, skipping WhatsApp send')
      await ctx.runMutation(internal.whatsapp.logNotification, {
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
            From: `whatsapp:${from}`,
            To: `whatsapp:${args.phone}`,
          }),
        }
      )

      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.message || `Twilio API error: ${resp.status}`)
      }

      await ctx.runMutation(internal.whatsapp.logNotification, {
        userId: args.userId,
        type: args.type,
        status: 'sent',
        twilioMessageSid: data.sid,
        metadata: args.metadata,
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('WhatsApp send failed:', errorMsg)

      await ctx.runMutation(internal.whatsapp.logNotification, {
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
    const adminIds = await ctx.runQuery(internal.whatsapp.getAdminsWithPermission, {
      cohortId: args.cohortId,
      permission: 'approve_invoices',
    })

    const recipients = await ctx.runQuery(internal.whatsapp.resolveRecipients, {
      userIds: adminIds,
      notificationType: 'invoiceSubmitted',
    })

    const message = `New invoice from ${args.startupName}: ${args.vendorName} — £${args.amountGbp.toFixed(2)}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.whatsapp.sendWhatsAppMessage, {
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
    const recipients = await ctx.runQuery(internal.whatsapp.resolveRecipients, {
      userIds: [args.userId],
      notificationType: 'invoiceStatusChanged',
    })

    if (recipients.length === 0) return

    const message = `Your invoice ${args.fileName} has been ${args.status}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.whatsapp.sendWhatsAppMessage, {
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
    const adminIds = await ctx.runQuery(internal.whatsapp.getAdminsWithPermission, {
      cohortId: args.cohortId,
      permission: 'approve_milestones',
    })

    const recipients = await ctx.runQuery(internal.whatsapp.resolveRecipients, {
      userIds: adminIds,
      notificationType: 'milestoneSubmitted',
    })

    const message = `New milestone submitted: ${args.milestoneTitle} from ${args.startupName}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.whatsapp.sendWhatsAppMessage, {
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
    const recipients = await ctx.runQuery(internal.whatsapp.resolveRecipients, {
      userIds: [args.userId],
      notificationType: 'milestoneStatusChanged',
    })

    if (recipients.length === 0) return

    const statusLabel = args.status === 'changes_requested' ? 'sent back for changes' : args.status
    const message = `Your milestone "${args.milestoneTitle}" has been ${statusLabel}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.whatsapp.sendWhatsAppMessage, {
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
    const todayEvents = await ctx.runQuery(internal.whatsapp.getEventsForDate, { date: today })

    for (const event of todayEvents) {
      const founderIds = await ctx.runQuery(internal.whatsapp.getFounderUserIdsInCohort, {
        cohortId: event.cohortId,
      })

      const recipients = await ctx.runQuery(internal.whatsapp.resolveRecipients, {
        userIds: founderIds,
        notificationType: 'eventReminders',
      })

      const message = `Reminder: ${event.title} is today`

      for (const r of recipients) {
        await ctx.scheduler.runAfter(0, internal.whatsapp.sendWhatsAppMessage, {
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
 * Send announcement to all founders in a cohort.
 */
export const sendAnnouncementNotification = internalAction({
  args: {
    cohortId: v.id('cohorts'),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const founderIds = await ctx.runQuery(internal.whatsapp.getFounderUserIdsInCohort, {
      cohortId: args.cohortId,
    })

    const recipients = await ctx.runQuery(internal.whatsapp.resolveRecipients, {
      userIds: founderIds,
      notificationType: 'announcements',
    })

    const message = `${args.title}: ${args.body}`

    for (const r of recipients) {
      await ctx.scheduler.runAfter(0, internal.whatsapp.sendWhatsAppMessage, {
        userId: r.userId,
        phone: r.phone,
        message,
        type: 'announcement',
        metadata: { title: args.title },
      })
    }
  },
})
