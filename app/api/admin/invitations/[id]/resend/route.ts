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
      .select(
        `
        id,
        full_name,
        email,
        token,
        accepted_at,
        startups (
          name
        )
      `
      )
      .eq('id', id)
      .single()

    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // 3. Check if invitation is already accepted
    if (invitation.accepted_at) {
      return NextResponse.json(
        { error: 'This invitation has already been accepted' },
        { status: 400 }
      )
    }

    // 4. Send invitation email
    try {
      // Handle startups relation - Supabase can return arrays for relations
      const startup = Array.isArray(invitation.startups) 
        ? invitation.startups[0] 
        : invitation.startups
      const startupName = (startup as { name: string } | null | undefined)?.name || 'Unknown Startup'

      await sendInvitationEmail({
        to: invitation.email,
        founderName: invitation.full_name,
        startupName,
        inviteToken: invitation.token,
        expirationDays: 14,
      })

      // 5. Update invitation timestamp
      await supabase
        .from('invitations')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      return NextResponse.json({ message: 'Invitation resent successfully' })
    } catch (emailError) {
      console.error('Failed to resend invitation email:', emailError)

      return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in POST /api/admin/invitations/[id]/resend:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
