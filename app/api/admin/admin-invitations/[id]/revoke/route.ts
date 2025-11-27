import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'

/**
 * POST /api/admin/admin-invitations/[id]/revoke
 * Revoke an admin invitation by setting expires_at to now (super admin only)
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin()
    const { id } = await params

    const supabase = await createClient()

    // Fetch the invitation to check if it's already accepted
    const { data: invitation, error: fetchError } = await supabase
      .from('admin_invitations')
      .select('id, accepted_at')
      .eq('id', id)
      .single()

    if (fetchError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Can't revoke an already accepted invitation
    if (invitation.accepted_at) {
      return NextResponse.json(
        { error: 'Cannot revoke an invitation that has already been accepted' },
        { status: 400 }
      )
    }

    // Revoke by setting expires_at to now
    const { error: updateError } = await supabase
      .from('admin_invitations')
      .update({ expires_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      console.error('Database error revoking admin invitation:', updateError)
      return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Invitation revoked successfully' }, { status: 200 })
  } catch (error) {
    console.error('Error in POST /api/admin/admin-invitations/[id]/revoke:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
