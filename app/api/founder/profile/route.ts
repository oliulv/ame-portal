import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireFounder } from '@/lib/auth'

/**
 * GET /api/founder/profile
 * Get the current founder's profile, startup, and bank details
 */
export async function GET() {
  try {
    // 1. Authenticate and authorize
    const user = await requireFounder()

    const supabase = await createClient()

    // 2. Get founder's profile
    const { data: founderProfile, error: profileError } = await supabase
      .from('founder_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError || !founderProfile) {
      return NextResponse.json({ error: 'Founder profile not found' }, { status: 404 })
    }

    // 3. Get startup details
    const { data: startup, error: startupError } = await supabase
      .from('startups')
      .select('id, name, website_url, slug')
      .eq('id', founderProfile.startup_id)
      .single()

    if (startupError || !startup) {
      return NextResponse.json({ error: 'Startup not found' }, { status: 404 })
    }

    // 4. Get startup profile
    const { data: startupProfile } = await supabase
      .from('startup_profiles')
      .select('*')
      .eq('startup_id', founderProfile.startup_id)
      .single()

    // 5. Get bank details
    const { data: bankDetails } = await supabase
      .from('bank_details')
      .select('*')
      .eq('startup_id', founderProfile.startup_id)
      .single()

    return NextResponse.json({
      founderProfile,
      startup,
      startupProfile: startupProfile || null,
      bankDetails: bankDetails || null,
    })
  } catch (error) {
    console.error('Error in GET /api/founder/profile:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/founder/profile
 * Update founder personal information
 */
export async function PATCH(request: Request) {
  try {
    // 1. Authenticate and authorize
    const user = await requireFounder()

    // 2. Parse and validate request body
    const body = await request.json()

    // Validate the fields we allow updating
    const updateData: Partial<{
      full_name: string
      personal_email: string
      address_line1: string | null
      address_line2: string | null
      city: string | null
      postcode: string | null
      country: string | null
      phone: string | null
      bio: string | null
      linkedin_url: string | null
      x_url: string | null
      updated_at?: string
    }> = {}

    if (body.full_name !== undefined) {
      if (typeof body.full_name !== 'string' || body.full_name.trim().length === 0) {
        return NextResponse.json({ error: 'Full name must be a non-empty string' }, { status: 400 })
      }
      updateData.full_name = body.full_name.trim()
    }

    if (body.personal_email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.personal_email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
      }
      updateData.personal_email = body.personal_email.trim()
    }

    if (body.address_line1 !== undefined) {
      updateData.address_line1 = body.address_line1?.trim() || null
    }

    if (body.address_line2 !== undefined) {
      updateData.address_line2 = body.address_line2?.trim() || null
    }

    if (body.city !== undefined) {
      updateData.city = body.city?.trim() || null
    }

    if (body.postcode !== undefined) {
      updateData.postcode = body.postcode?.trim() || null
    }

    if (body.country !== undefined) {
      updateData.country = body.country?.trim() || null
    }

    if (body.phone !== undefined) {
      updateData.phone = body.phone?.trim() || null
    }

    if (body.bio !== undefined) {
      updateData.bio = body.bio?.trim() || null
    }

    if (body.linkedin_url !== undefined) {
      const url = body.linkedin_url?.trim() || ''
      if (url && !url.match(/^https?:\/\/.+/)) {
        return NextResponse.json({ error: 'LinkedIn URL must be a valid URL' }, { status: 400 })
      }
      updateData.linkedin_url = url || null
    }

    if (body.x_url !== undefined) {
      const url = body.x_url?.trim() || ''
      if (url && !url.match(/^https?:\/\/.+/)) {
        return NextResponse.json({ error: 'X URL must be a valid URL' }, { status: 400 })
      }
      updateData.x_url = url || null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updateData.updated_at = new Date().toISOString()

    const supabase = await createClient()

    // 3. Update founder profile
    const { data, error } = await supabase
      .from('founder_profiles')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error updating founder profile:', error)
      return NextResponse.json({ error: 'Failed to update founder profile' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      founderProfile: data,
    })
  } catch (error) {
    console.error('Error in PATCH /api/founder/profile:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
