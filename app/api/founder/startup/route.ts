import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireFounder } from '@/lib/auth'

/**
 * PATCH /api/founder/startup
 * Update startup details (name, website_url) and startup profile
 */
export async function PATCH(request: Request) {
  try {
    // 1. Authenticate and authorize
    const user = await requireFounder()

    // 2. Parse request body
    const body = await request.json()

    const supabase = await createClient()

    // 3. Get founder's profile to find startup_id
    const { data: founderProfile, error: profileError } = await supabase
      .from('founder_profiles')
      .select('startup_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !founderProfile) {
      return NextResponse.json({ error: 'Founder profile not found' }, { status: 404 })
    }

    // 4. Update startup table fields (name, website_url)
    const startupUpdateData: Partial<{
      name: string
      website_url: string | null
      updated_at: string
    }> = {}

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Startup name must be a non-empty string' },
          { status: 400 }
        )
      }
      startupUpdateData.name = body.name.trim()
    }

    if (body.website_url !== undefined) {
      const url = body.website_url?.trim() || ''
      if (url && !url.match(/^https?:\/\/.+/)) {
        return NextResponse.json({ error: 'Website URL must be a valid URL' }, { status: 400 })
      }
      startupUpdateData.website_url = url || null
    }

    if (Object.keys(startupUpdateData).length > 0) {
      startupUpdateData.updated_at = new Date().toISOString()

      const { error: startupError } = await supabase
        .from('startups')
        .update(startupUpdateData)
        .eq('id', founderProfile.startup_id)

      if (startupError) {
        console.error('Database error updating startup:', startupError)
        return NextResponse.json({ error: 'Failed to update startup' }, { status: 500 })
      }
    }

    // 5. Update startup profile fields
    const startupProfileUpdateData: Partial<{
      one_liner: string | null
      description: string | null
      industry: string | null
      location: string | null
      initial_customers: number | null
      initial_revenue: number | null
    }> = {}

    if (body.one_liner !== undefined) {
      startupProfileUpdateData.one_liner = body.one_liner?.trim() || null
    }

    if (body.description !== undefined) {
      startupProfileUpdateData.description = body.description?.trim() || null
    }

    if (body.industry !== undefined) {
      startupProfileUpdateData.industry = body.industry?.trim() || null
    }

    if (body.location !== undefined) {
      startupProfileUpdateData.location = body.location?.trim() || null
    }

    if (body.initial_customers !== undefined) {
      const customers = body.initial_customers
      if (customers !== null && (typeof customers !== 'number' || customers < 0)) {
        return NextResponse.json(
          { error: 'Initial customers must be a non-negative number' },
          { status: 400 }
        )
      }
      startupProfileUpdateData.initial_customers = customers
    }

    if (body.initial_revenue !== undefined) {
      const revenue = body.initial_revenue
      if (revenue !== null && (typeof revenue !== 'number' || revenue < 0)) {
        return NextResponse.json(
          { error: 'Initial revenue must be a non-negative number' },
          { status: 400 }
        )
      }
      startupProfileUpdateData.initial_revenue = revenue
    }

    if (Object.keys(startupProfileUpdateData).length > 0) {
      startupProfileUpdateData.updated_at = new Date().toISOString()

      // Check if startup profile exists
      const { data: existingProfile } = await supabase
        .from('startup_profiles')
        .select('id')
        .eq('startup_id', founderProfile.startup_id)
        .single()

      if (existingProfile) {
        // Update existing profile
        const { error: profileUpdateError } = await supabase
          .from('startup_profiles')
          .update(startupProfileUpdateData)
          .eq('id', existingProfile.id)

        if (profileUpdateError) {
          console.error('Database error updating startup profile:', profileUpdateError)
          return NextResponse.json({ error: 'Failed to update startup profile' }, { status: 500 })
        }
      } else {
        // Create new profile
        const { error: profileInsertError } = await supabase.from('startup_profiles').insert({
          startup_id: founderProfile.startup_id,
          ...startupProfileUpdateData,
        })

        if (profileInsertError) {
          console.error('Database error creating startup profile:', profileInsertError)
          return NextResponse.json({ error: 'Failed to create startup profile' }, { status: 500 })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Startup details updated successfully',
    })
  } catch (error) {
    console.error('Error in PATCH /api/founder/startup:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
