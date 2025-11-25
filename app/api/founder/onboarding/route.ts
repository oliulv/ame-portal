import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { completeOnboardingSchema } from '@/lib/schemas'
import { requireFounder } from '@/lib/auth'
import { ZodError } from 'zod'

/**
 * POST /api/founder/onboarding
 * Complete founder onboarding process
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate and authorize
    const user = await requireFounder()

    // 2. Parse and validate request body
    const body = await request.json()
    const validatedData = completeOnboardingSchema.parse(body)

    const supabase = await createClient()

    // 3. Get founder's profile to find startup_id
    const { data: founderProfile, error: profileError } = await supabase
      .from('founder_profiles')
      .select('id, startup_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !founderProfile) {
      return NextResponse.json({ error: 'Founder profile not found' }, { status: 404 })
    }

    // 4. Update founder profile with personal info
    const { error: founderUpdateError } = await supabase
      .from('founder_profiles')
      .update({
        address_line1: validatedData.founderInfo.address_line1,
        address_line2: validatedData.founderInfo.address_line2,
        city: validatedData.founderInfo.city,
        postcode: validatedData.founderInfo.postcode,
        country: validatedData.founderInfo.country,
        phone: validatedData.founderInfo.phone,
        bio: validatedData.founderInfo.bio,
        linkedin_url: validatedData.founderInfo.linkedin_url,
        x_url: validatedData.founderInfo.x_url,
        onboarding_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', founderProfile.id)

    if (founderUpdateError) {
      console.error('Error updating founder profile:', founderUpdateError)
      return NextResponse.json({ error: 'Failed to update founder profile' }, { status: 500 })
    }

    // 5. Create or update startup profile
    const { data: existingStartupProfile } = await supabase
      .from('startup_profiles')
      .select('id')
      .eq('startup_id', founderProfile.startup_id)
      .single()

    if (existingStartupProfile) {
      // Update existing profile
      const { error: startupUpdateError } = await supabase
        .from('startup_profiles')
        .update({
          one_liner: validatedData.startupProfile.one_liner,
          description: validatedData.startupProfile.description,
          company_url: validatedData.startupProfile.company_url,
          product_url: validatedData.startupProfile.product_url,
          industry: validatedData.startupProfile.industry,
          location: validatedData.startupProfile.location,
          initial_customers: validatedData.startupProfile.initial_customers,
          initial_revenue: validatedData.startupProfile.initial_revenue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingStartupProfile.id)

      if (startupUpdateError) {
        console.error('Error updating startup profile:', startupUpdateError)
        return NextResponse.json({ error: 'Failed to update startup profile' }, { status: 500 })
      }
    } else {
      // Create new profile
      const { error: startupInsertError } = await supabase.from('startup_profiles').insert({
        startup_id: founderProfile.startup_id,
        one_liner: validatedData.startupProfile.one_liner,
        description: validatedData.startupProfile.description,
        company_url: validatedData.startupProfile.company_url,
        product_url: validatedData.startupProfile.product_url,
        industry: validatedData.startupProfile.industry,
        location: validatedData.startupProfile.location,
        initial_customers: validatedData.startupProfile.initial_customers,
        initial_revenue: validatedData.startupProfile.initial_revenue,
      })

      if (startupInsertError) {
        console.error('Error creating startup profile:', startupInsertError)
        return NextResponse.json({ error: 'Failed to create startup profile' }, { status: 500 })
      }
    }

    // 6. Create or update bank details (only if provided)
    if (validatedData.bankDetails) {
      const { data: existingBankDetails } = await supabase
        .from('bank_details')
        .select('id')
        .eq('startup_id', founderProfile.startup_id)
        .single()

      if (existingBankDetails) {
        // Update existing bank details
        const { error: bankUpdateError } = await supabase
          .from('bank_details')
          .update({
            account_holder_name: validatedData.bankDetails.account_holder_name,
            sort_code: validatedData.bankDetails.sort_code,
            account_number: validatedData.bankDetails.account_number,
            bank_name: validatedData.bankDetails.bank_name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingBankDetails.id)

        if (bankUpdateError) {
          console.error('Error updating bank details:', bankUpdateError)
          return NextResponse.json({ error: 'Failed to update bank details' }, { status: 500 })
        }
      } else {
        // Create new bank details
        const { error: bankInsertError } = await supabase.from('bank_details').insert({
          startup_id: founderProfile.startup_id,
          account_holder_name: validatedData.bankDetails.account_holder_name,
          sort_code: validatedData.bankDetails.sort_code,
          account_number: validatedData.bankDetails.account_number,
          bank_name: validatedData.bankDetails.bank_name,
          verified: false,
        })

        if (bankInsertError) {
          console.error('Error creating bank details:', bankInsertError)
          return NextResponse.json({ error: 'Failed to create bank details' }, { status: 500 })
        }
      }
    }

    // 7. Update startup onboarding status
    const { error: startupStatusError } = await supabase
      .from('startups')
      .update({
        onboarding_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', founderProfile.startup_id)

    if (startupStatusError) {
      console.error('Error updating startup status:', startupStatusError)
      // Don't return error here as the main data is saved
    }

    // 8. Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Onboarding completed successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in POST /api/founder/onboarding:', error)

    // Handle validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      )
    }

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
