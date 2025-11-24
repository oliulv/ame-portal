import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireFounder } from '@/lib/auth'

/**
 * PATCH /api/founder/bank
 * Update bank details for the founder's startup
 */
export async function PATCH(request: Request) {
  try {
    // 1. Authenticate and authorize
    const user = await requireFounder()

    // 2. Parse and validate request body
    const body = await request.json()

    // Validate required fields
    if (!body.account_holder_name || typeof body.account_holder_name !== 'string' || body.account_holder_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Account holder name is required' },
        { status: 400 }
      )
    }

    if (!body.sort_code || typeof body.sort_code !== 'string') {
      return NextResponse.json(
        { error: 'Sort code is required' },
        { status: 400 }
      )
    }

    // Validate sort code format (XX-XX-XX)
    const sortCodeRegex = /^\d{2}-\d{2}-\d{2}$/
    if (!sortCodeRegex.test(body.sort_code)) {
      return NextResponse.json(
        { error: 'Sort code must be in format XX-XX-XX' },
        { status: 400 }
      )
    }

    if (!body.account_number || typeof body.account_number !== 'string') {
      return NextResponse.json(
        { error: 'Account number is required' },
        { status: 400 }
      )
    }

    // Validate account number format (8 digits)
    const accountNumberRegex = /^\d{8}$/
    if (!accountNumberRegex.test(body.account_number)) {
      return NextResponse.json(
        { error: 'Account number must be 8 digits' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 3. Get founder's profile to find startup_id
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

    // 4. Prepare update data
    const updateData = {
      account_holder_name: body.account_holder_name.trim(),
      sort_code: body.sort_code.trim(),
      account_number: body.account_number.trim(),
      bank_name: body.bank_name?.trim() || null,
      verified: false, // Reset verification when details are updated
      updated_at: new Date().toISOString(),
    }

    // 5. Check if bank details exist
    const { data: existingBankDetails } = await supabase
      .from('bank_details')
      .select('id')
      .eq('startup_id', founderProfile.startup_id)
      .single()

    if (existingBankDetails) {
      // Update existing bank details
      const { data, error } = await supabase
        .from('bank_details')
        .update(updateData)
        .eq('id', existingBankDetails.id)
        .select()
        .single()

      if (error) {
        console.error('Database error updating bank details:', error)
        return NextResponse.json(
          { error: 'Failed to update bank details' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        bankDetails: data,
      })
    } else {
      // Create new bank details
      const { data, error } = await supabase
        .from('bank_details')
        .insert({
          startup_id: founderProfile.startup_id,
          ...updateData,
        })
        .select()
        .single()

      if (error) {
        console.error('Database error creating bank details:', error)
        return NextResponse.json(
          { error: 'Failed to create bank details' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        bankDetails: data,
      })
    }
  } catch (error) {
    console.error('Error in PATCH /api/founder/bank:', error)

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

