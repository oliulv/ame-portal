import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireFounder } from '@/lib/auth'

/**
 * GET /api/founder/onboarding/bank-status
 * Check if bank details already exist for the founder's startup
 */
export async function GET() {
  try {
    // 1. Authenticate and authorize
    const user = await requireFounder()

    const supabase = await createClient()

    // 2. Get founder's profile to find startup_id
    const { data: founderProfile, error: profileError } = await supabase
      .from('founder_profiles')
      .select('startup_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !founderProfile) {
      return NextResponse.json(
        { error: 'Founder profile not found' },
        { status: 404 }
      )
    }

    // 3. Check if bank details exist for this startup
    const { data: bankDetails, error: bankError } = await supabase
      .from('bank_details')
      .select('id')
      .eq('startup_id', founderProfile.startup_id)
      .single()

    // If no bank details found, that's okay - return false
    if (bankError && bankError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected
      console.error('Error checking bank details:', bankError)
      return NextResponse.json(
        { error: 'Failed to check bank details' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      hasBankDetails: !!bankDetails,
    })
  } catch (error) {
    console.error('Error in GET /api/founder/onboarding/bank-status:', error)

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

