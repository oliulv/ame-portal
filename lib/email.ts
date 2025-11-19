import { Resend } from 'resend'

// Initialize Resend with API key (or dummy key for build time)
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build')

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export interface InvitationEmailParams {
  to: string
  founderName: string
  startupName: string
  inviteToken: string
  expirationDays?: number
}

/**
 * Generate HTML email template for founder invitation
 */
function generateInvitationEmailHTML(params: {
  founderName: string
  startupName: string
  invitationLink: string
  expirationDays: number
}): string {
  const { founderName, startupName, invitationLink, expirationDays } = params

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AccelerateMe Invitation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">AccelerateMe</h1>
        </div>

        <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937; margin-top: 0;">Welcome to AccelerateMe!</h2>

          <p>Hi ${founderName},</p>

          <p>You've been invited to join <strong>${startupName}</strong> on the AccelerateMe platform. This platform helps you track your startup's progress, manage goals, and streamline funding processes.</p>

          <p>Click the button below to accept your invitation and complete your profile:</p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${invitationLink}" style="background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Accept Invitation
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="${invitationLink}" style="color: #667eea; word-break: break-all;">${invitationLink}</a>
          </p>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 24px 0; border-radius: 4px;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>⚠️ This invitation expires in ${expirationDays} days.</strong>
            </p>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>© ${new Date().getFullYear()} AccelerateMe. All rights reserved.</p>
        </div>
      </body>
    </html>
  `
}

/**
 * Send an invitation email to a founder
 */
export async function sendInvitationEmail({
  to,
  founderName,
  startupName,
  inviteToken,
  expirationDays = 14,
}: InvitationEmailParams) {
  const inviteUrl = `${APP_URL}/invite/${inviteToken}`

  // Check if API key is properly configured
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_dummy_key_for_build') {
    console.warn('RESEND_API_KEY is not configured. Email not sent.')
    throw new Error('Email service not configured. Please set RESEND_API_KEY environment variable.')
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'AccelerateMe <onboarding@resend.dev>', // TODO: Update with actual sender domain
      to,
      subject: `You're invited to join ${startupName} on AccelerateMe`,
      html: generateInvitationEmailHTML({
        founderName,
        startupName,
        invitationLink: inviteUrl,
        expirationDays,
      }),
    })

    if (error) {
      console.error('Failed to send invitation email:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Error sending invitation email:', error)
    throw error
  }
}

