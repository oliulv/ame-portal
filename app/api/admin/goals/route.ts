import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { goalTemplateSchema } from '@/lib/schemas'
import { requireAdmin } from '@/lib/auth'

/**
 * GET /api/admin/goals
 * Fetch all goal templates, optionally filtered by cohort_id
 */
export async function GET(request: Request) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // 2. Get query parameters
    const { searchParams } = new URL(request.url)
    const cohortId = searchParams.get('cohort_id')

    // 3. Fetch goal templates from database
    const supabase = await createClient()
    let query = supabase
      .from('goal_templates')
      .select('*')
      .order('category', { ascending: true })

    // Filter by cohort if provided
    if (cohortId) {
      query = query.eq('cohort_id', cohortId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Database error fetching goal templates:', error)
      return NextResponse.json(
        { error: 'Failed to fetch goal templates' },
        { status: 500 }
      )
    }

    // 4. Return goal templates data
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error in GET /api/admin/goals:', error)

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

/**
 * POST /api/admin/goals
 * Create a new goal template
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // 2. Parse and validate request body
    const body = await request.json()
    const validatedData = goalTemplateSchema.parse(body)

    // 3. Create goal template in database
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('goal_templates')
      .insert({
        cohort_id: validatedData.cohort_id,
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        default_target_value: validatedData.default_target_value,
        default_deadline: validatedData.default_deadline,
        default_weight: validatedData.default_weight,
        default_funding_amount: validatedData.default_funding_amount,
        is_active: validatedData.is_active,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error creating goal template:', error)
      return NextResponse.json(
        { error: 'Failed to create goal template' },
        { status: 500 }
      )
    }

    // 4. Return success response
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/goals:', error)

    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
        { status: 400 }
      )
    }

    // Handle authentication errors
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
