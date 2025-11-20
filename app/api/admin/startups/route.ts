import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startupSchema } from '@/lib/schemas'
import { requireAdmin } from '@/lib/auth'
import { generateStartupSlug } from '@/lib/slugify'

/**
 * GET /api/admin/startups
 * Fetch all startups, optionally filtered by cohort_id
 */
export async function GET(request: Request) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // 2. Get query parameters
    const { searchParams } = new URL(request.url)
    const cohortId = searchParams.get('cohort_id')

    // 3. Fetch startups from database
    const supabase = await createClient()
    let query = supabase
      .from('startups')
      .select('*')
      .order('name', { ascending: true })

    // Filter by cohort if provided
    if (cohortId) {
      query = query.eq('cohort_id', cohortId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Database error fetching startups:', error)
      return NextResponse.json(
        { error: 'Failed to fetch startups' },
        { status: 500 }
      )
    }

    // 4. Return startups data
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error in GET /api/admin/startups:', error)

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
 * POST /api/admin/startups
 * Create a new startup with related records and auto-assign goals
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // 2. Parse and validate request body
    const body = await request.json()
    const validatedData = startupSchema.parse(body)

    const supabase = await createClient()

    // 3. Generate unique slug for the startup
    // First, fetch existing slugs to ensure uniqueness
    const { data: existingStartups } = await supabase
      .from('startups')
      .select('slug')

    const existingSlugs = existingStartups?.map((s) => s.slug) || []
    const slug = generateStartupSlug(validatedData.name, existingSlugs)

    // 4. Create startup record
    const { data: startup, error: startupError } = await supabase
      .from('startups')
      .insert({
        name: validatedData.name,
        slug,
        cohort_id: validatedData.cohort_id,
        logo_url: validatedData.logo_url || null,
        sector: validatedData.sector || null,
        stage: validatedData.stage || null,
        website_url: validatedData.website_url || null,
        notes: validatedData.notes || null,
      })
      .select()
      .single()

    if (startupError || !startup) {
      console.error('Database error creating startup:', startupError)
      return NextResponse.json(
        { error: 'Failed to create startup' },
        { status: 500 }
      )
    }

    // 5. Create startup_profiles record (empty placeholder)
    const { error: profileError } = await supabase
      .from('startup_profiles')
      .insert({
        startup_id: startup.id,
        // All other fields are nullable, so we just create an empty record
      })

    if (profileError) {
      console.error('Error creating startup profile:', profileError)
      // Non-critical, log but continue
    }

    // 6. Create bank_details record (empty placeholder)
    const { error: bankError } = await supabase
      .from('bank_details')
      .insert({
        startup_id: startup.id,
        // All other fields are nullable
      })

    if (bankError) {
      console.error('Error creating bank details:', bankError)
      // Non-critical, log but continue
    }

    // 7. Fetch active goal templates for this cohort
    const { data: goalTemplates, error: templatesError } = await supabase
      .from('goal_templates')
      .select('*')
      .eq('cohort_id', validatedData.cohort_id)
      .eq('is_active', true)

    if (templatesError) {
      console.error('Error fetching goal templates:', templatesError)
      // Non-critical, startup is already created
    }

    // 8. Create startup_goals from templates
    if (goalTemplates && goalTemplates.length > 0) {
      const goalsToCreate = goalTemplates.map((template) => ({
        startup_id: startup.id,
        goal_template_id: template.id,
        title: template.title,
        description: template.description,
        category: template.category,
        target_value: template.default_target_value,
        deadline: template.default_deadline,
        weight: template.default_weight || 1,
        funding_amount: template.default_funding_amount,
        status: 'not_started' as const,
        progress_value: 0,
        manually_overridden: false,
      }))

      const { error: goalsError } = await supabase
        .from('startup_goals')
        .insert(goalsToCreate)

      if (goalsError) {
        console.error('Error creating startup goals:', goalsError)
        // Non-critical, log but continue
      }
    }

    // 9. Return success response with startup data
    return NextResponse.json(startup, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/startups:', error)

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
