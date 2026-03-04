import { query, mutation, internalAction } from './functions'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireAdmin } from './auth'
import { generateToken, getExpiration } from './lib/tokens'
import { evaluateUserCleanup } from './lib/userCleanup'

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
 * List team members (from founderProfiles) and pending invitations for a startup.
 * Used by the admin startup detail page to show accurate team state.
 */
export const listTeamAndPending = query({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Team members from founderProfiles
    const profiles = await ctx.db
      .query('founderProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()

    const teamMembers = await Promise.all(
      profiles.map(async (profile) => {
        const user = await ctx.db.get(profile.userId)
        return {
          _id: profile._id,
          fullName: profile.fullName,
          email: profile.personalEmail,
          userId: profile.userId,
          userExists: !!user,
        }
      })
    )

    // Pending invitations (not accepted and not expired)
    const now = new Date().toISOString()
    const allInvitations = await ctx.db
      .query('invitations')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()

    const pendingInvitations = allInvitations
      .filter((inv) => !inv.acceptedAt && inv.expiresAt > now)
      .map((inv) => ({
        _id: inv._id,
        fullName: inv.fullName,
        email: inv.email,
        expiresAt: inv.expiresAt,
        _creationTime: inv._creationTime,
      }))

    return { teamMembers, pendingInvitations }
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
    expiresInDays: v.optional(v.number()),
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

    const expiresInDays = Math.min(args.expiresInDays ?? 14, 30)

    // Generate token
    const token = generateToken()
    const expiresAt = getExpiration(expiresInDays)

    const invitationId = await ctx.db.insert('invitations', {
      startupId: args.startupId,
      email: args.email,
      fullName: args.fullName,
      token,
      role: 'founder',
      expiresAt,
      createdByAdminId: admin._id,
      createdByUserId: admin._id,
    })

    // Schedule email sending action
    const startup = await ctx.db.get(args.startupId)
    await ctx.scheduler.runAfter(0, internal.invitations.sendEmail, {
      to: args.email,
      founderName: args.fullName,
      startupName: startup?.name ?? 'Unknown Startup',
      inviteToken: token,
      expirationDays: expiresInDays,
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
      // Never overwrite admin/super_admin role — they keep their admin role
      // and get founder access via founderProfile.
      // Never overwrite email/fullName — those are synced from Clerk by ensureUser().
      // Invitation data (email, fullName) is stored in the founderProfile instead.
      if (existingUser.role !== 'admin' && existingUser.role !== 'super_admin') {
        await ctx.db.patch(existingUser._id, {
          role: 'founder',
        })
      }
    } else {
      userId = await ctx.db.insert('users', {
        clerkId: args.clerkId,
        role: 'founder',
        // Set email/fullName from invitation for new users — ensureUser()
        // will sync from Clerk on subsequent logins.
        email: invitation.email,
        fullName: invitation.fullName,
      })
    }

    // Guard against duplicate profiles (React StrictMode can trigger the effect twice)
    const existingProfile = await ctx.db
      .query('founderProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('startupId'), invitation.startupId))
      .first()

    if (!existingProfile) {
      await ctx.db.insert('founderProfiles', {
        userId,
        startupId: invitation.startupId,
        fullName: invitation.fullName,
        personalEmail: invitation.email,
        onboardingStatus: 'pending',
      })
    }

    // Mark invitation as accepted
    await ctx.db.patch(invitation._id, {
      acceptedAt: new Date().toISOString(),
    })

    return userId
  },
})

/**
 * Remove a founder from a startup (admin). Deletes founderProfile and invitation,
 * then evaluates whether the user should be fully cleaned up (Convex + Clerk).
 */
export const removeFounder = mutation({
  args: { id: v.id('invitations') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const invitation = await ctx.db.get(args.id)
    if (!invitation) throw new Error('Invitation not found')

    // Delete the founderProfile linked to this invitation's email + startup
    // and capture the userId for cleanup evaluation
    let userId: (typeof profiles)[0]['userId'] | null = null
    const profiles = await ctx.db
      .query('founderProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', invitation.startupId))
      .collect()

    for (const profile of profiles) {
      if (profile.personalEmail === invitation.email) {
        userId = profile.userId
        await ctx.db.delete(profile._id)
      }
    }

    // Delete the invitation itself
    await ctx.db.delete(invitation._id)

    // If the invitation was accepted (had a user), evaluate full cleanup
    if (userId) {
      await evaluateUserCleanup(ctx, userId)
    }
  },
})

/**
 * Remove a team member by their founderProfile ID (admin).
 * Deletes the founderProfile, matching invitation, then evaluates full cleanup.
 */
export const removeTeamMember = mutation({
  args: { id: v.id('founderProfiles') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const profile = await ctx.db.get(args.id)
    if (!profile) throw new Error('Founder profile not found')

    const userId = profile.userId

    // Delete the matching invitation (by startupId + email)
    const invitations = await ctx.db
      .query('invitations')
      .withIndex('by_startupId', (q) => q.eq('startupId', profile.startupId))
      .filter((q) => q.eq(q.field('email'), profile.personalEmail))
      .collect()

    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id)
    }

    // Delete the founderProfile
    await ctx.db.delete(profile._id)

    // Evaluate whether the user should be fully cleaned up
    await evaluateUserCleanup(ctx, userId)
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
export const sendEmail = internalAction({
  args: {
    to: v.string(),
    founderName: v.string(),
    startupName: v.string(),
    inviteToken: v.string(),
    expirationDays: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const fromEmail = process.env.FROM_EMAIL
    const appUrl = process.env.APP_URL
    if (!fromEmail) throw new Error('FROM_EMAIL environment variable is not set')
    if (!appUrl) throw new Error('APP_URL environment variable is not set')

    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const inviteUrl = `${appUrl}/invite/${encodeURIComponent(args.inviteToken)}`

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: args.to,
      subject: `You're invited to join ${args.startupName} on Accelerate ME`,
      html: generateInvitationHtml({
        founderName: args.founderName,
        startupName: args.startupName,
        invitationLink: inviteUrl,
        expirationDays: args.expirationDays ?? 14,
      }),
    })

    if (error) {
      throw new Error(`Failed to send invitation email to ${args.to}: ${error.message}`)
    }
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
<body style="font-family:Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#121c17;max-width:600px;margin:0 auto;padding:20px">
<div style="background:#1a4230;padding:40px 20px;text-align:center">
<h1 style="font-family:'Source Serif 4','Georgia',serif;color:#ffffff;margin:0;font-size:28px;font-weight:600">Accelerate ME</h1></div>
<div style="background:#ffffff;padding:40px;border:1px solid #bfd0c6;border-top:none">
<h2 style="font-family:'Source Serif 4','Georgia',serif;color:#121c17;margin-top:0">Welcome to Accelerate ME!</h2>
<p>Hi ${founderName},</p>
<p>You've been invited to join <strong>${startupName}</strong> on the Accelerate ME platform.</p>
<div style="text-align:center;margin:32px 0">
<a href="${invitationLink}" style="background:#1a4230;color:#ffffff;padding:14px 32px;text-decoration:none;display:inline-block;font-weight:600">Accept Invitation</a></div>
<p style="color:#6b7280;font-size:14px">Or copy and paste this link:<br><a href="${invitationLink}" style="color:#1a4230;word-break:break-all">${invitationLink}</a></p>
<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin:24px 0">
<p style="margin:0;color:#92400e;font-size:14px"><strong>This invitation expires in ${expirationDays} days.</strong></p></div>
</div></body></html>`
}
