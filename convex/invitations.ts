import { query, mutation, action } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireAdmin } from './auth'
import { generateToken, getExpiration } from './lib/tokens'

/**
 * List invitations for a specific startup.
 */
export const list = query({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    return await ctx.db
      .query('invitations')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()
  },
})

/**
 * Get an invitation by token (public, used in accept flow).
 */
export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('invitations')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()
  },
})

/**
 * Create a new invitation and send email.
 */
export const create = mutation({
  args: {
    startupId: v.id('startups'),
    email: v.string(),
    fullName: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    // Check if email already has an accepted invitation for this startup
    const existing = await ctx.db
      .query('invitations')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .filter((q) => q.eq(q.field('email'), args.email))
      .first()

    if (existing?.acceptedAt) {
      throw new Error('This email has already accepted an invitation for this startup')
    }

    // Generate token
    const token = generateToken()
    const expiresAt = getExpiration(14)

    const invitationId = await ctx.db.insert('invitations', {
      startupId: args.startupId,
      email: args.email,
      fullName: args.fullName,
      token,
      role: 'founder',
      expiresAt,
      createdByAdminId: admin._id,
    })

    // Schedule email sending action
    const startup = await ctx.db.get(args.startupId)
    await ctx.scheduler.runAfter(0, internal.invitations.sendEmail, {
      to: args.email,
      founderName: args.fullName,
      startupName: startup?.name ?? 'Unknown Startup',
      inviteToken: token,
    })

    return invitationId
  },
})

/**
 * Accept an invitation (called when founder clicks invite link).
 */
export const accept = mutation({
  args: { token: v.string(), clerkId: v.string() },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query('invitations')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()

    if (!invitation) throw new Error('Invitation not found')
    if (invitation.acceptedAt) throw new Error('Invitation already accepted')
    if (new Date(invitation.expiresAt) < new Date()) throw new Error('Invitation expired')

    // Create user record
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', args.clerkId))
      .unique()

    let userId
    if (existingUser) {
      userId = existingUser._id
    } else {
      userId = await ctx.db.insert('users', {
        clerkId: args.clerkId,
        role: 'founder',
        email: invitation.email,
        fullName: invitation.fullName,
      })
    }

    // Create founder profile
    await ctx.db.insert('founderProfiles', {
      userId,
      startupId: invitation.startupId,
      fullName: invitation.fullName,
      personalEmail: invitation.email,
      onboardingStatus: 'pending',
    })

    // Mark invitation as accepted
    await ctx.db.patch(invitation._id, {
      acceptedAt: new Date().toISOString(),
    })

    return userId
  },
})

/**
 * Resend invitation email (action).
 */
export const resend = mutation({
  args: { id: v.id('invitations') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const invitation = await ctx.db.get(args.id)
    if (!invitation) throw new Error('Invitation not found')
    if (invitation.acceptedAt) throw new Error('Invitation already accepted')

    const startup = await ctx.db.get(invitation.startupId)

    await ctx.scheduler.runAfter(0, internal.invitations.sendEmail, {
      to: invitation.email,
      founderName: invitation.fullName,
      startupName: startup?.name ?? 'Unknown Startup',
      inviteToken: invitation.token,
    })
  },
})

/**
 * Internal action to send invitation email via Resend.
 */
export const sendEmail = action({
  args: {
    to: v.string(),
    founderName: v.string(),
    startupName: v.string(),
    inviteToken: v.string(),
  },
  handler: async (_ctx, args) => {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteUrl = `${appUrl}/invite/${encodeURIComponent(args.inviteToken)}`

    await resend.emails.send({
      from: 'AccelerateMe <onboarding@resend.dev>',
      to: args.to,
      subject: `You're invited to join ${args.startupName} on AccelerateMe`,
      html: generateInvitationHtml({
        founderName: args.founderName,
        startupName: args.startupName,
        invitationLink: inviteUrl,
        expirationDays: 14,
      }),
    })
  },
})

// ── Helpers ──────────────────────────────────────────────────────────

function generateInvitationHtml(params: {
  founderName: string
  startupName: string
  invitationLink: string
  expirationDays: number
}): string {
  const { founderName, startupName, invitationLink, expirationDays } = params
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px">
<div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 20px;text-align:center;border-radius:8px 8px 0 0">
<h1 style="color:white;margin:0;font-size:28px">AccelerateMe</h1></div>
<div style="background:white;padding:40px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
<h2 style="color:#1f2937;margin-top:0">Welcome to AccelerateMe!</h2>
<p>Hi ${founderName},</p>
<p>You've been invited to join <strong>${startupName}</strong> on the AccelerateMe platform.</p>
<div style="text-align:center;margin:32px 0">
<a href="${invitationLink}" style="background:#667eea;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600">Accept Invitation</a></div>
<p style="color:#6b7280;font-size:14px">Or copy and paste this link:<br><a href="${invitationLink}" style="color:#667eea;word-break:break-all">${invitationLink}</a></p>
<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin:24px 0;border-radius:4px">
<p style="margin:0;color:#92400e;font-size:14px"><strong>This invitation expires in ${expirationDays} days.</strong></p></div>
</div></body></html>`
}
