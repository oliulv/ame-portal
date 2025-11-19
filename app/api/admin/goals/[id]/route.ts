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
    const { data, error } = await supabase
      .from('goal_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Goal template not found' },
        { status: 404 }
      )
    }

    // 3. Return goal template data
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/admin/goals/[id]:', error)

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

    // 3. Update goal template in database
    const supabase = await createClient()
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
      return NextResponse.json(
        { error: 'Failed to update goal template' },
        { status: 500 }
      )
    }

    // 4. Return success response
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PATCH /api/admin/goals/[id]:', error)

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

/**
 * DELETE /api/admin/goals/[id]
 * Deactivate a goal template (soft delete)
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // Get the goal template ID from params
    const { id } = await context.params

    // 2. Deactivate goal template (soft delete)
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('goal_templates')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error deactivating goal template:', error)
      return NextResponse.json(
        { error: 'Failed to deactivate goal template' },
        { status: 500 }
      )
    }

    // 3. Return success response
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in DELETE /api/admin/goals/[id]:', error)

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
