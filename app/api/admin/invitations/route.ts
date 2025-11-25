import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { invitationSchema } from '@/lib/schemas'
import { requireAdmin } from '@/lib/auth'
import { generateInvitationToken, getInvitationExpiration } from '@/lib/tokens'
import { sendInvitationEmail } from '@/lib/email'

/**
 * GET /api/admin/invitations?startup_id=xxx
 * Fetch invitations for a specific startup
 */
export async function GET(request: Request) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // 2. Get query parameters
    const { searchParams } = new URL(request.url)
    const startupId = searchParams.get('startup_id')

    if (!startupId) {
      return NextResponse.json({ error: 'startup_id query parameter is required' }, { status: 400 })
    }

    // 3. Fetch invitations from database
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('invitations')
      .select('id, full_name, email, accepted_at, created_at, expires_at')
      .eq('startup_id', startupId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error fetching invitations:', error)
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
    }

    // 4. Return invitations data
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error in GET /api/admin/invitations:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/invitations
 * Create a new invitation and send email
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate and authorize
    const admin = await requireAdmin()

    // 2. Parse and validate request body
    const body = await request.json()
    const validatedData = invitationSchema.parse(body)

    const supabase = await createClient()

    // 3. Check if email already has an invitation for this startup
    const { data: existingInvitation } = await supabase
      .from('invitations')
      .select('id, accepted_at')
      .eq('startup_id', validatedData.startup_id)
      .eq('email', validatedData.personal_email)
      .single()

    if (existingInvitation && existingInvitation.accepted_at) {
      return NextResponse.json(
        { error: 'This email has already accepted an invitation for this startup' },
        { status: 400 }
      )
    }

    // 4. Get startup details for email
    const { data: startup } = await supabase
      .from('startups')
      .select('name')
      .eq('id', validatedData.startup_id)
      .single()

    if (!startup) {
      return NextResponse.json({ error: 'Startup not found' }, { status: 404 })
    }

    // 5. Generate secure token and expiration
    const token = generateInvitationToken()
    const expiresAt = getInvitationExpiration(14) // 14 days

    // 6. Create invitation record
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .insert({
        startup_id: validatedData.startup_id,
        full_name: validatedData.full_name,
        email: validatedData.personal_email,
        token,
        expires_at: expiresAt,
        created_by_admin_id: admin.id,
      })
      .select()
      .single()

    if (invitationError || !invitation) {
      console.error('Database error creating invitation:', invitationError)
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
    }

    // 7. Send invitation email
    try {
      await sendInvitationEmail({
        to: validatedData.personal_email,
        founderName: validatedData.full_name,
        startupName: startup.name,
        inviteToken: token,
        expirationDays: 14,
      })
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      // Note: We can't track email failure status in the database
      // The invitation is created but email failed - admin can resend if needed

      return NextResponse.json(
        { error: 'Invitation created but email failed to send. Please try resending.' },
        { status: 500 }
      )
    }

    // 8. Return success response
    return NextResponse.json(invitation, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/invitations:', error)

    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error }, { status: 400 })
    }

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
