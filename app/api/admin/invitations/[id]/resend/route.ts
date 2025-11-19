import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { sendInvitationEmail } from '@/lib/email'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

/**
 * POST /api/admin/invitations/[id]/resend
 * Resend an invitation email
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // Get the invitation ID from params
    const { id } = await context.params

    const supabase = await createClient()

    // 2. Fetch invitation with startup details
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select(`
        id,
        full_name,
        personal_email,
        token,
        status,
        startups (
          name
        )
      `)
      .eq('id', id)
      .single()

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // 3. Check if invitation is already accepted
    if (invitation.status === 'accepted') {
      return NextResponse.json(
        { error: 'This invitation has already been accepted' },
        { status: 400 }
      )
    }

    // 4. Send invitation email
    try {
      await sendInvitationEmail({
        to: invitation.personal_email,
        founderName: invitation.full_name,
        startupName: (invitation.startups as any).name,
        inviteToken: invitation.token,
        expirationDays: 14,
      })

      // 5. Update invitation status to 'sent'
      await supabase
        .from('invitations')
        .update({
          status: 'sent',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      return NextResponse.json({ message: 'Invitation resent successfully' })
    } catch (emailError) {
      console.error('Failed to resend invitation email:', emailError)

      // Update invitation status to 'failed'
      await supabase
        .from('invitations')
        .update({ status: 'failed' })
        .eq('id', id)

      return NextResponse.json(
        { error: 'Failed to send invitation email' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in POST /api/admin/invitations/[id]/resend:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
