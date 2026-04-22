import { query, mutation } from './functions'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireFounder, getFounderStartupIds } from './auth'
import { generateToken, getExpiration } from './lib/tokens'

/**
 * List team members (founder profiles) for the current founder's startup.
 */
export const listTeamMembers = query({
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) return []

    const startupId = startupIds[0]
    const profiles = await ctx.db
      .query('founderProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
      .collect()

    return await Promise.all(
      profiles.map(async (p) => {
        const memberUser = await ctx.db.get(p.userId)
        return {
          _id: p._id,
          fullName: p.fullName,
          personalEmail: p.personalEmail,
          isCurrentUser: p.userId === user._id,
          imageUrl: memberUser?.imageUrl,
        }
      })
    )
  },
})

/**
 * List pending (non-accepted, non-expired) invitations for the current founder's startup.
 */
export const listPendingInvitations = query({
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) return []

    const startupId = startupIds[0]
    const invitations = await ctx.db
      .query('invitations')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
      .collect()

    const now = new Date()
    return invitations
      .filter((inv) => !inv.acceptedAt && new Date(inv.expiresAt) > now)
      .map((inv) => ({
        _id: inv._id,
        email: inv.email,
        fullName: inv.fullName,
        expiresAt: inv.expiresAt,
      }))
  },
})

/**
 * Create a new invitation from a founder and send email.
 */
export const create = mutation({
  args: {
    email: v.string(),
    fullName: v.string(),
    expiresInDays: v.optional(v.number()),
    appUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) {
      throw new Error('No startup associated with your account')
    }

    const startupId = startupIds[0]

    // Check for existing invitation or team member with this email. Case-insensitive so
    // "Bob@Ex.com" and "bob@ex.com" are treated as the same person — otherwise a founder
    // can bypass the "already accepted" guard by toggling the casing.
    const startupInvites = await ctx.db
      .query('invitations')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
      .collect()

    const emailLower = args.email.toLowerCase()
    const matchingInvites = startupInvites.filter((inv) => inv.email.toLowerCase() === emailLower)
    const existingAccepted = matchingInvites.find((inv) => inv.acceptedAt)
    const existingPending = matchingInvites.find(
      (inv) => !inv.acceptedAt && new Date(inv.expiresAt) > new Date()
    )

    if (existingAccepted) {
      throw new Error('This email has already accepted an invitation for this startup')
    }

    if (existingPending) {
      throw new Error('A pending invitation already exists for this email')
    }

    const expiresInDays = Math.min(args.expiresInDays ?? 14, 30)

    const token = generateToken()
    const expiresAt = getExpiration(expiresInDays)

    const invitationId = await ctx.db.insert('invitations', {
      startupId,
      email: args.email,
      fullName: args.fullName,
      token,
      role: 'founder',
      expiresAt,
      createdByUserId: user._id,
    })

    const startup = await ctx.db.get(startupId)
    await ctx.scheduler.runAfter(0, internal.invitations.sendEmail, {
      to: args.email,
      founderName: args.fullName,
      startupName: startup?.name ?? 'Unknown Startup',
      inviteToken: token,
      expirationDays: expiresInDays,
      appUrl: args.appUrl,
    })

    return invitationId
  },
})

/**
 * Resend a pending invitation email.
 */
export const resend = mutation({
  args: { id: v.id('invitations'), appUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    const invitation = await ctx.db.get(args.id)
    if (!invitation) throw new Error('Invitation not found')
    if (invitation.acceptedAt) throw new Error('Invitation already accepted')
    if (!startupIds.includes(invitation.startupId)) {
      throw new Error('You do not have access to this invitation')
    }

    const startup = await ctx.db.get(invitation.startupId)

    await ctx.scheduler.runAfter(0, internal.invitations.sendEmail, {
      to: invitation.email,
      founderName: invitation.fullName,
      startupName: startup?.name ?? 'Unknown Startup',
      inviteToken: invitation.token,
      appUrl: args.appUrl,
    })
  },
})
