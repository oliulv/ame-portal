import { query, mutation, internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireSuperAdmin } from './auth'
import { generateToken, getExpiration } from './lib/tokens'

/**
 * List admin invitations, optionally filtered by cohort.
 */
export const list = query({
  args: { cohortId: v.optional(v.id('cohorts')) },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    if (args.cohortId) {
      return await ctx.db
        .query('adminInvitations')
        .filter((q) => q.eq(q.field('cohortId'), args.cohortId))
        .collect()
    }

    return await ctx.db.query('adminInvitations').collect()
  },
})

/**
 * Create a new admin invitation and send email.
 */
export const create = mutation({
  args: {
    email: v.string(),
    invitedName: v.optional(v.string()),
    cohortId: v.id('cohorts'),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const superAdmin = await requireSuperAdmin(ctx)

    // Verify cohort exists
    const cohort = await ctx.db.get(args.cohortId)
    if (!cohort) throw new Error('Cohort not found')

    const expiresInDays = Math.min(args.expiresInDays ?? 14, 30)

    // Check for existing active invitation
    const existing = await ctx.db
      .query('adminInvitations')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .filter((q) => q.eq(q.field('cohortId'), args.cohortId))
      .first()

    if (existing && !existing.acceptedAt && new Date(existing.expiresAt) > new Date()) {
      throw new Error('There is already an active admin invitation for this email and cohort')
    }

    const token = generateToken()
    const expiresAt = getExpiration(expiresInDays)

    const id = await ctx.db.insert('adminInvitations', {
      email: args.email,
      invitedName: args.invitedName,
      token,
      role: 'admin',
      expiresAt,
      createdByUserId: superAdmin._id,
      cohortId: args.cohortId,
    })

    // Schedule email
    await ctx.scheduler.runAfter(0, internal.adminInvitations.sendEmail, {
      to: args.email,
      invitedName: args.invitedName,
      inviteToken: token,
      expirationDays: expiresInDays,
    })

    return id
  },
})

/**
 * Resend an admin invitation email.
 */
export const resend = mutation({
  args: { id: v.id('adminInvitations') },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    const invitation = await ctx.db.get(args.id)
    if (!invitation) throw new Error('Invitation not found')
    if (invitation.acceptedAt) throw new Error('Already accepted')
    if (new Date(invitation.expiresAt) < new Date()) throw new Error('Invitation expired')

    const daysLeft = Math.max(
      1,
      Math.ceil((new Date(invitation.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    )

    await ctx.scheduler.runAfter(0, internal.adminInvitations.sendEmail, {
      to: invitation.email,
      invitedName: invitation.invitedName,
      inviteToken: invitation.token,
      expirationDays: daysLeft,
    })
  },
})

/**
 * Revoke an admin invitation (set expiry to now).
 */
export const revoke = mutation({
  args: { id: v.id('adminInvitations') },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    const invitation = await ctx.db.get(args.id)
    if (!invitation) throw new Error('Invitation not found')
    if (invitation.acceptedAt) throw new Error('Cannot revoke accepted invitation')

    await ctx.db.patch(args.id, {
      expiresAt: new Date().toISOString(),
    })
  },
})

/**
 * Accept an admin invitation.
 */
export const accept = mutation({
  args: { token: v.string(), clerkId: v.string() },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query('adminInvitations')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()

    if (!invitation) throw new Error('Invitation not found')
    if (invitation.acceptedAt) throw new Error('Already accepted')
    if (new Date(invitation.expiresAt) < new Date()) throw new Error('Invitation expired')

    // Create or update user record
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique()

    let userId
    if (existingUser) {
      await ctx.db.patch(existingUser._id, { role: 'admin' })
      userId = existingUser._id
    } else {
      userId = await ctx.db.insert('users', {
        clerkId: args.clerkId,
        role: 'admin',
        email: invitation.email,
        fullName: invitation.invitedName,
      })
    }

    // Assign to cohort if specified
    if (invitation.cohortId) {
      const existingAssignment = await ctx.db
        .query('adminCohorts')
        .withIndex('by_userId_cohortId', (q) =>
          q.eq('userId', userId).eq('cohortId', invitation.cohortId!)
        )
        .unique()

      if (!existingAssignment) {
        await ctx.db.insert('adminCohorts', {
          userId,
          cohortId: invitation.cohortId,
        })
      }
    }

    // Mark as accepted
    await ctx.db.patch(invitation._id, {
      acceptedAt: new Date().toISOString(),
    })

    return userId
  },
})

/**
 * Internal action to send admin invitation email via Resend.
 */
export const sendEmail = internalAction({
  args: {
    to: v.string(),
    invitedName: v.optional(v.string()),
    inviteToken: v.string(),
    expirationDays: v.number(),
  },
  handler: async (_ctx, args) => {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteUrl = `${appUrl}/admin-invite/${encodeURIComponent(args.inviteToken)}`

    const name = args.invitedName || 'there'

    await resend.emails.send({
      from: 'Accelerate ME <onboarding@resend.dev>',
      to: args.to,
      subject: 'You have been invited as an admin on Accelerate ME',
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#1a1714;padding:40px 20px;text-align:center;border-radius:8px 8px 0 0">
<h1 style="color:#faf8f4;margin:0;font-size:28px;font-weight:600">Accelerate ME</h1></div>
<div style="background:#ffffff;padding:40px;border:1px solid #e8e4de;border-top:none;border-radius:0 0 8px 8px">
<h2 style="color:#1a1714;margin-top:0">You've been invited as an admin</h2>
<p>Hi ${name},</p>
<p>You've been invited to join the <strong>Accelerate ME</strong> internal tool as an administrator.</p>
<div style="text-align:center;margin:32px 0">
<a href="${inviteUrl}" style="background:#1a1714;color:#faf8f4;padding:14px 32px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600">Accept Admin Invitation</a></div>
<p style="color:#6b7280;font-size:14px">Or copy and paste this link:<br><a href="${inviteUrl}" style="color:#1a1714;word-break:break-all">${inviteUrl}</a></p>
<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin:24px 0;border-radius:4px">
<p style="margin:0;color:#92400e;font-size:14px"><strong>This invitation expires in ${args.expirationDays} days.</strong></p></div>
</div></body></html>`,
    })
  },
})
