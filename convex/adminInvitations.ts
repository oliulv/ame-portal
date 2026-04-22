import { query, mutation, internalAction } from './functions'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireAdmin } from './auth'
import { generateToken, getExpiration } from './lib/tokens'
import { evaluateInviteAccept } from './lib/inviteAccept'

/**
 * Get an admin invitation by token (public, used in accept flow). Returns a
 * minimal projection — no token, no role, no cohortId, no internal IDs —
 * so a successful lookup by a guessed token leaks only the invited
 * email/name and expiry state, and never reveals the privilege tier.
 */
export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const inv = await ctx.db
      .query('adminInvitations')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()
    if (!inv) return null
    return {
      email: inv.email,
      invitedName: inv.invitedName,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
    }
  },
})

/**
 * List admin invitations, optionally filtered by cohort.
 */
export const list = query({
  args: { cohortId: v.optional(v.id('cohorts')) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

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
    role: v.optional(v.union(v.literal('admin'), v.literal('super_admin'))),
    appUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const inviter = await requireAdmin(ctx)

    // Verify cohort exists
    const cohort = await ctx.db.get(args.cohortId)
    if (!cohort) throw new Error('Cohort not found')

    // Only super_admins can invite as super_admin
    const invitedRole: 'admin' | 'super_admin' =
      inviter.role === 'super_admin' && args.role === 'super_admin' ? 'super_admin' : 'admin'

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
      role: invitedRole,
      expiresAt,
      createdByUserId: inviter._id,
      cohortId: args.cohortId,
    })

    // Schedule email
    await ctx.scheduler.runAfter(0, internal.adminInvitations.sendEmail, {
      to: args.email,
      invitedName: args.invitedName,
      inviteToken: token,
      expirationDays: expiresInDays,
      appUrl: args.appUrl,
    })

    return id
  },
})

/**
 * Resend an admin invitation email.
 */
export const resend = mutation({
  args: { id: v.id('adminInvitations'), appUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

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
      appUrl: args.appUrl,
    })
  },
})

/**
 * Delete an admin invitation record.
 */
export const remove = mutation({
  args: { id: v.id('adminInvitations') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const invitation = await ctx.db.get(args.id)
    if (!invitation) throw new Error('Invitation not found')

    await ctx.db.delete(args.id)
  },
})

/**
 * Revoke an admin invitation (set expiry to now).
 */
export const revoke = mutation({
  args: { id: v.id('adminInvitations') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

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
 *
 * Security: the caller must be authenticated with Clerk, and the Clerk
 * identity email must match the invitation email (case-insensitive). We
 * derive `clerkId` from `ctx.auth.getUserIdentity()` rather than accepting
 * it as a client-supplied argument — a token-holder cannot bind an admin
 * or super_admin invitation to an arbitrary Clerk account.
 */
export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')
    const clerkId = identity.subject
    const clerkEmail = identity.email

    const invitation = await ctx.db
      .query('adminInvitations')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique()

    if (!invitation) throw new Error('Invitation not found')

    const decision = evaluateInviteAccept(invitation, clerkEmail, new Date())
    if (decision.ok === false && decision.reason === 'wrong_email') {
      throw new Error('This invitation was sent to a different email address')
    }

    if (invitation.acceptedAt) throw new Error('Already accepted')
    if (new Date(invitation.expiresAt) < new Date()) throw new Error('Invitation expired')

    // Create or update user record. Never downgrade an existing higher-privilege
    // user: an admin who can issue invitations should not be able to strip a
    // super_admin's role by inviting them as `admin` and waiting for them to
    // click accept.
    const ROLE_PRIORITY = { founder: 0, admin: 1, super_admin: 2 } as const

    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', clerkId))
      .unique()

    let userId
    if (existingUser) {
      if (ROLE_PRIORITY[invitation.role] > ROLE_PRIORITY[existingUser.role]) {
        await ctx.db.patch(existingUser._id, { role: invitation.role })
      }
      userId = existingUser._id
    } else {
      userId = await ctx.db.insert('users', {
        clerkId,
        role: invitation.role,
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
    appUrl: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const fromEmail = process.env.FROM_EMAIL
    const appUrl = args.appUrl ?? process.env.APP_URL
    if (!fromEmail) throw new Error('FROM_EMAIL environment variable is not set')
    if (!appUrl) throw new Error('APP_URL environment variable is not set and no appUrl provided')

    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const inviteUrl = `${appUrl}/admin-invite/${encodeURIComponent(args.inviteToken)}`

    const name = args.invitedName || 'there'

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: args.to,
      subject: 'You have been invited as an admin on Accelerate ME',
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#121c17;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#1a4230;padding:40px 20px;text-align:center">
<h1 style="font-family:'Source Serif 4','Georgia',serif;color:#ffffff;margin:0;font-size:28px;font-weight:600">Accelerate ME</h1></div>
<div style="background:#ffffff;padding:40px;border:1px solid #bfd0c6;border-top:none">
<h2 style="font-family:'Source Serif 4','Georgia',serif;color:#121c17;margin-top:0">You've been invited as an admin</h2>
<p>Hi ${name},</p>
<p>You've been invited to join the <strong>Accelerate ME</strong> internal tool as an administrator.</p>
<div style="text-align:center;margin:32px 0">
<a href="${inviteUrl}" style="background:#1a4230;color:#ffffff;padding:14px 32px;text-decoration:none;display:inline-block;font-weight:600">Accept Admin Invitation</a></div>
<p style="color:#6b7280;font-size:14px">Or copy and paste this link:<br><a href="${inviteUrl}" style="color:#1a4230;word-break:break-all">${inviteUrl}</a></p>
<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin:24px 0">
<p style="margin:0;color:#92400e;font-size:14px"><strong>This invitation expires in ${args.expirationDays} days.</strong></p></div>
</div></body></html>`,
    })

    if (error) {
      throw new Error(`Failed to send admin invitation email to ${args.to}: ${error.message}`)
    }
  },
})
