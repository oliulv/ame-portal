import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import { sendAdminInvitationEmail } from '@/lib/email'

/**
 * POST /api/admin/admin-invitations/[id]/resend
 * Resend an admin invitation email (super admin only)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin()
    const { id } = await params

    const supabase = await createClient()

    // Fetch the invitation
    const { data: invitation, error: fetchError } = await supabase
      .from('admin_invitations')
      .select('id, email, invited_name, token, expires_at, accepted_at')
      .eq('id', id)
      .single()

    if (fetchError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Check if already accepted
    if (invitation.accepted_at) {
      return NextResponse.json(
        { error: 'This invitation has already been accepted' },
        { status: 400 }
      )
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 })
    }

    // Calculate days until expiration
    const expiresAt = new Date(invitation.expires_at)
    const now = new Date()
    const daysUntilExpiration = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Resend the email
    try {
      await sendAdminInvitationEmail({
        to: invitation.email,
        invitedName: invitation.invited_name,
        inviteToken: invitation.token,
        expirationDays: Math.max(1, daysUntilExpiration),
      })
    } catch (emailError) {
      console.error('Failed to resend admin invitation email:', emailError)
      return NextResponse.json(
        { error: 'Failed to resend invitation email' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Invitation email resent successfully' }, { status: 200 })
  } catch (error) {
    console.error('Error in POST /api/admin/admin-invitations/[id]/resend:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

