import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { goalTemplateSchema } from '@/lib/schemas'
import { requireAdmin } from '@/lib/auth'
import { formatDescriptionWithConditions } from '@/lib/goalUtils'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

/**
 * PATCH /api/goal-templates/[id]
 * Update an existing goal template with condition-based success criteria
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

    // Extract target value from first condition for backward compatibility
    const firstCondition = validatedData.conditions[0]
    const targetValue = firstCondition?.targetValue || null

    // Store conditions as JSON string in description (temporary until migration)
    const descriptionWithConditions = formatDescriptionWithConditions(
      validatedData.description,
      validatedData.conditions
    )

    const { data, error } = await supabase
      .from('goal_templates')
      .update({
        cohort_id: validatedData.cohortId,
        title: validatedData.title,
        description: descriptionWithConditions,
        category: validatedData.category,
        default_deadline: validatedData.deadline || null,
        default_target_value: targetValue,
        default_funding_amount: validatedData.fundingUnlocked || null,
        is_active: validatedData.isActive,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error updating goal template:', error)
      return NextResponse.json({ error: 'Failed to update goal template' }, { status: 500 })
    }

    // 4. Return success response
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PATCH /api/goal-templates/[id]:', error)

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
