import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { goalTemplateSchema } from '@/lib/schemas'
import { requireAdmin } from '@/lib/auth'
import { formatDescriptionWithConditions } from '@/lib/goalUtils'

/**
 * POST /api/goal-templates
 * Create a new goal template with condition-based success criteria
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
    
    // Get the max display_order for this cohort to set the new goal's order
    const { data: maxOrderData } = await supabase
      .from('goal_templates')
      .select('display_order')
      .eq('cohort_id', validatedData.cohortId)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    const nextDisplayOrder = maxOrderData?.display_order 
      ? maxOrderData.display_order + 1 
      : 1
    
    // Insert the new goal template
    // Note: Until database migration adds 'conditions' (JSONB) column,
    // we store conditions as JSON in description and extract target value for backward compatibility
    const firstCondition = validatedData.conditions[0]
    const targetValue = firstCondition?.targetValue || null
    
    // Store conditions as JSON string in description (temporary until migration)
    const descriptionWithConditions = formatDescriptionWithConditions(
      validatedData.description,
      validatedData.conditions
    )
    
    const { data, error } = await supabase
      .from('goal_templates')
      .insert({
        cohort_id: validatedData.cohortId,
        title: validatedData.title,
        description: descriptionWithConditions,
        category: validatedData.category,
        default_deadline: validatedData.deadline || null,
        default_target_value: targetValue, // Extract from first condition for backward compatibility
        default_weight: 1, // Default weight
        default_funding_amount: validatedData.fundingUnlocked || null,
        is_active: validatedData.isActive,
        display_order: nextDisplayOrder,
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

    // 4. If template is active, assign it to existing startups in this cohort
    if (validatedData.isActive && data) {
      // Fetch all startups in this cohort
      const { data: startups, error: startupsError } = await supabase
        .from('startups')
        .select('id')
        .eq('cohort_id', validatedData.cohortId)

      if (startupsError) {
        console.error('Error fetching startups for goal assignment:', startupsError)
        // Non-critical, continue and return the template
      } else if (startups && startups.length > 0) {
        // For each startup, check if they already have this goal template assigned
        // and create startup_goals if not
        const goalsToCreate = []
        
        for (const startup of startups) {
          // Check if this startup already has a goal from this template
          const { data: existingGoal } = await supabase
            .from('startup_goals')
            .select('id')
            .eq('startup_id', startup.id)
            .eq('goal_template_id', data.id)
            .maybeSingle()

          // Only create if it doesn't exist
          if (!existingGoal) {
            // Use the original description (without conditions JSON comment)
            const cleanDescription = validatedData.description || null
            
            goalsToCreate.push({
              startup_id: startup.id,
              goal_template_id: data.id,
              title: validatedData.title,
              description: cleanDescription,
              category: validatedData.category,
              target_value: targetValue, // Already extracted above
              deadline: validatedData.deadline || null,
              weight: 1, // Default weight
              funding_amount: validatedData.fundingUnlocked || null,
              status: 'not_started' as const,
              progress_value: 0,
              manually_overridden: false,
            })
          }
        }

        // Bulk insert all new goals
        if (goalsToCreate.length > 0) {
          const { error: goalsError } = await supabase
            .from('startup_goals')
            .insert(goalsToCreate)

          if (goalsError) {
            console.error('Error assigning goal template to existing startups:', goalsError)
            // Non-critical, log but continue
          }
        }
      }
    }

    // 5. Return success response
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/goal-templates:', error)

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

