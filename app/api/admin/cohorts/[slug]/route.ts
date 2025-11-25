import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cohortSchema } from '@/lib/schemas'
import { requireAdmin } from '@/lib/auth'
import { generateCohortSlug } from '@/lib/slugify'

interface RouteContext {
  params: Promise<{
    slug: string
  }>
}

/**
 * GET /api/admin/cohorts/[slug]
 * Fetch a single cohort by slug
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // Get the cohort slug from params
    const { slug } = await context.params

    // 2. Fetch cohort from database
    const supabase = await createClient()
    const { data, error } = await supabase.from('cohorts').select('*').eq('slug', slug).single()

    if (error || !data) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 })
    }

    // 3. Return cohort data
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/admin/cohorts/[slug]:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/cohorts/[slug]
 * Update an existing cohort
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // Get the cohort slug from params
    const { slug } = await context.params

    // 2. Parse and validate request body
    const body = await request.json()
    const validatedData = cohortSchema.parse(body)

    // 3. Check if label is being updated and regenerate slug if needed
    const supabase = await createClient()
    let newSlug = slug // Default to current slug

    // Fetch current cohort to check if label changed
    const { data: currentCohort } = await supabase
      .from('cohorts')
      .select('label')
      .eq('slug', slug)
      .single()

    if (currentCohort && validatedData.label !== currentCohort.label) {
      // Label changed, regenerate slug
      const { data: existingCohorts } = await supabase.from('cohorts').select('slug')

      const existingSlugs = existingCohorts?.map((c) => c.slug) || []
      newSlug = generateCohortSlug(
        validatedData.label,
        existingSlugs.filter((s) => s !== slug)
      )
    }

    // 4. Update cohort in database
    const { data, error } = await supabase
      .from('cohorts')
      .update({
        name: validatedData.name,
        label: validatedData.label,
        slug: newSlug,
        year_start: validatedData.year_start,
        year_end: validatedData.year_end,
        is_active: validatedData.is_active,
      })
      .eq('slug', slug)
      .select()
      .single()

    if (error) {
      console.error('Database error updating cohort:', error)
      return NextResponse.json({ error: 'Failed to update cohort' }, { status: 500 })
    }

    // 5. Return success response
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PATCH /api/admin/cohorts/[slug]:', error)

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
