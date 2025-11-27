import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import { generateInvitationToken, getInvitationExpiration } from '@/lib/tokens'
import { sendAdminInvitationEmail } from '@/lib/email'

/**
 * GET /api/admin/admin-invitations
 * Fetch admin invitations (super admin only)
 *
 * Query parameters:
 * - cohort_id (optional): If provided, returns invitations for that cohort
 */
export async function GET(request: Request) {
  try {
    await requireSuperAdmin()
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const cohortId = searchParams.get('cohort_id')

    let query = supabase
      .from('admin_invitations')
      .select('id, email, invited_name, role, expires_at, accepted_at, cohort_id, created_at')

    if (cohortId) {
      query = query.eq('cohort_id', cohortId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Database error fetching admin invitations:', error)
      return NextResponse.json({ error: 'Failed to fetch admin invitations' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error in GET /api/admin/admin-invitations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/admin-invitations
 * Create a new admin invitation and send email
 *
 * Request body:
 * - email: string (required)
 * - invited_name: string (optional)
 * - expires_in_days: number (optional, default: 14)
 * - cohort_id: string (required) - The cohort this admin will be assigned to
 */
export async function POST(request: Request) {
  try {
    const superAdmin = await requireSuperAdmin()
    const body = await request.json()

    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const invitedName =
      typeof body.invited_name === 'string' && body.invited_name.trim().length > 0
        ? body.invited_name.trim()
        : undefined
    const expiresInDays =
      typeof body.expires_in_days === 'number' && body.expires_in_days > 0
        ? Math.min(body.expires_in_days, 30)
        : 14
    const cohortId = typeof body.cohort_id === 'string' ? body.cohort_id.trim() : null

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!cohortId) {
      return NextResponse.json({ error: 'cohort_id is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify cohort exists
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select('id')
      .eq('id', cohortId)
      .single()

    if (cohortError || !cohort) {
      return NextResponse.json({ error: 'Invalid cohort_id' }, { status: 400 })
    }

    // Optional: prevent duplicate pending invites for the same email and cohort
    const { data: existing } = await supabase
      .from('admin_invitations')
      .select('id, accepted_at, expires_at')
      .eq('email', email)
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existing && !existing.accepted_at && new Date(existing.expires_at) > new Date()) {
      return NextResponse.json(
        { error: 'There is already an active admin invitation for this email and cohort' },
        { status: 400 }
      )
    }

    const token = generateInvitationToken()
    const expiresAt = getInvitationExpiration(expiresInDays)

    const { data: invitation, error } = await supabase
      .from('admin_invitations')
      .insert({
        email,
        invited_name: invitedName,
        token,
        role: 'admin',
        expires_at: expiresAt,
        created_by_user_id: superAdmin.id,
        cohort_id: cohortId,
      })
      .select()
      .single()

    if (error || !invitation) {
      console.error('Database error creating admin invitation:', error)
      return NextResponse.json({ error: 'Failed to create admin invitation' }, { status: 500 })
    }

    try {
      await sendAdminInvitationEmail({
        to: email,
        invitedName,
        inviteToken: token,
        expirationDays: expiresInDays,
      })
    } catch (emailError) {
      console.error('Failed to send admin invitation email:', emailError)
      return NextResponse.json(
        {
          error: 'Admin invitation created but email failed to send. Please try resending.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(invitation, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/admin-invitations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
