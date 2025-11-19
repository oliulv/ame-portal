import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cohortSchema } from '@/lib/schemas'
import { requireAdmin } from '@/lib/auth'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

/**
 * GET /api/admin/cohorts/[id]
 * Fetch a single cohort by ID
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // Get the cohort ID from params
    const { id } = await context.params

    // 2. Fetch cohort from database
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cohorts')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Cohort not found' },
        { status: 404 }
      )
    }

    // 3. Return cohort data
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/admin/cohorts/[id]:', error)

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
 * PATCH /api/admin/cohorts/[id]
 * Update an existing cohort
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // Get the cohort ID from params
    const { id } = await context.params

    // 2. Parse and validate request body
    const body = await request.json()
    const validatedData = cohortSchema.parse(body)

    // 3. Update cohort in database
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cohorts')
      .update({
        name: validatedData.name,
        label: validatedData.label,
        year_start: validatedData.year_start,
        year_end: validatedData.year_end,
        is_active: validatedData.is_active,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error updating cohort:', error)
      return NextResponse.json(
        { error: 'Failed to update cohort' },
        { status: 500 }
      )
    }

    // 4. Return success response
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PATCH /api/admin/cohorts/[id]:', error)

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
