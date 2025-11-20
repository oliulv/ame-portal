import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cohortSchema } from '@/lib/schemas'
import { requireAdmin } from '@/lib/auth'
import { generateCohortSlug } from '@/lib/slugify'

/**
 * GET /api/admin/cohorts
 * Fetch all cohorts
 */
export async function GET() {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // 2. Fetch all cohorts from database
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cohorts')
      .select('id, slug, label, name, year_start, year_end, is_active')
      .order('year_start', { ascending: false })

    if (error) {
      console.error('Database error fetching cohorts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch cohorts' },
        { status: 500 }
      )
    }

    // 3. Return cohorts data
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/admin/cohorts:', error)

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
 * POST /api/admin/cohorts
 * Create a new cohort
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // 2. Parse and validate request body
    const body = await request.json()
    const validatedData = cohortSchema.parse(body)

    // 3. Generate unique slug for the cohort
    const supabase = await createClient()
    const { data: existingCohorts } = await supabase
      .from('cohorts')
      .select('slug')

    const existingSlugs = existingCohorts?.map((c) => c.slug) || []
    const slug = generateCohortSlug(validatedData.label, existingSlugs)

    // 4. Create cohort in database
    const { data, error } = await supabase
      .from('cohorts')
      .insert({
        name: validatedData.name,
        label: validatedData.label,
        slug,
        year_start: validatedData.year_start,
        year_end: validatedData.year_end,
        is_active: validatedData.is_active,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error creating cohort:', error)
      return NextResponse.json(
        { error: 'Failed to create cohort' },
        { status: 500 }
      )
    }

    // 5. Create default "Join AccelerateMe" goal template for this cohort
    if (data) {
      const { error: goalError } = await supabase
        .from('goal_templates')
        .insert({
          cohort_id: data.id,
          title: 'Join AccelerateMe',
          description: 'Welcome to the program! Your journey starts here.',
          category: 'launch',
          is_active: true,
          display_order: 0, // Always first
        })

      if (goalError) {
        console.error('Error creating default AccelerateMe goal:', goalError)
        // Non-critical, continue and return the cohort
      }
    }

    // 6. Return success response
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/cohorts:', error)

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
