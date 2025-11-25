import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { goalTemplateSchema } from '@/lib/schemas'
import { requireAdmin } from '@/lib/auth'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

/**
 * GET /api/admin/goals/[id]
 * Fetch a single goal template by ID
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // Get the goal template ID from params
    const { id } = await context.params

    // 2. Fetch goal template from database
    const supabase = await createClient()
    const { data, error } = await supabase.from('goal_templates').select('*').eq('id', id).single()

    if (error || !data) {
      return NextResponse.json({ error: 'Goal template not found' }, { status: 404 })
    }

    // 3. Return goal template data
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/admin/goals/[id]:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/goals/[id]
 * Update an existing goal template
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // Get the goal template ID from params
    const { id } = await context.params

    // 2. Parse and validate request body
    const body = await request.json()
    const validatedData = goalTemplateSchema.parse(body)

    // 3. Fetch current template state to check if is_active is changing
    const supabase = await createClient()
    const { data: currentTemplate } = await supabase
      .from('goal_templates')
      .select('is_active, cohort_id')
      .eq('id', id)
      .single()

    // 4. Update goal template in database
    const { data, error } = await supabase
      .from('goal_templates')
      .update({
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
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error updating goal template:', error)
      return NextResponse.json({ error: 'Failed to update goal template' }, { status: 500 })
    }

    // 5. If template was just activated (changed from inactive to active), assign to existing startups
    const wasInactive = currentTemplate && !currentTemplate.is_active
    const isNowActive = validatedData.is_active

    if (wasInactive && isNowActive && data) {
      // Fetch all startups in this cohort
      const { data: startups, error: startupsError } = await supabase
        .from('startups')
        .select('id')
        .eq('cohort_id', validatedData.cohort_id)

      if (startupsError) {
        console.error('Error fetching startups for goal assignment:', startupsError)
        // Non-critical, continue
      } else if (startups && startups.length > 0) {
        const goalsToCreate = []

        for (const startup of startups) {
          // Check if this startup already has a goal from this template
          const { data: existingGoal } = await supabase
            .from('startup_goals')
            .select('id')
            .eq('startup_id', startup.id)
            .eq('goal_template_id', id)
            .maybeSingle()

          // Only create if it doesn't exist
          if (!existingGoal) {
            goalsToCreate.push({
              startup_id: startup.id,
              goal_template_id: id,
              title: validatedData.title,
              description: validatedData.description,
              category: validatedData.category,
              target_value: validatedData.default_target_value,
              deadline: validatedData.default_deadline,
              weight: validatedData.default_weight || 1,
              funding_amount: validatedData.default_funding_amount,
              status: 'not_started' as const,
              progress_value: 0,
              manually_overridden: false,
            })
          }
        }

        // Bulk insert all new goals
        if (goalsToCreate.length > 0) {
          const { error: goalsError } = await supabase.from('startup_goals').insert(goalsToCreate)

          if (goalsError) {
            console.error('Error assigning goal template to existing startups:', goalsError)
            // Non-critical, log but continue
          }
        }
      }
    }

    // 6. Return success response
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PATCH /api/admin/goals/[id]:', error)

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

/**
 * DELETE /api/admin/goals/[id]
 * Delete a goal template
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // Get the goal template ID from params
    const { id } = await context.params

    // 2. Delete goal template
    const supabase = await createClient()
    const { error } = await supabase.from('goal_templates').delete().eq('id', id)

    if (error) {
      console.error('Database error deleting goal template:', error)
      return NextResponse.json({ error: 'Failed to delete goal template' }, { status: 500 })
    }

    // 3. Return success response
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/admin/goals/[id]:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
