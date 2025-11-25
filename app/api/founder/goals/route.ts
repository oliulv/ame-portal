import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFounderStartupIds, requireFounder } from '@/lib/auth'

/**
 * GET /api/founder/goals
 * Fetch all goals for the current founder's startup(s)
 */
export async function GET() {
  try {
    // 1. Authenticate and authorize
    await requireFounder()

    // 2. Get founder's startup IDs
    const startupIds = await getFounderStartupIds()

    if (startupIds.length === 0) {
      return NextResponse.json([])
    }

    // 3. Fetch startup data to get cohort_id
    const supabase = await createClient()
    const { data: startups } = await supabase
      .from('startups')
      .select('id, cohort_id')
      .in('id', startupIds)

    if (!startups || startups.length === 0) {
      return NextResponse.json([])
    }

    // Get the cohort_id (assuming founder has one startup, or use the first one)
    const cohortId = startups[0].cohort_id

    // 4. Fetch the AccelerateMe goal template for this cohort (if cohort_id exists)
    let accelerateMeTemplate = null
    if (cohortId) {
      const { data } = await supabase
        .from('goal_templates')
        .select('*')
        .eq('cohort_id', cohortId)
        .eq('title', 'Join AccelerateMe')
        .maybeSingle()
      accelerateMeTemplate = data
    }

    // 5. Fetch goals from database, joined with goal_templates to get display_order
    const { data, error } = await supabase
      .from('startup_goals')
      .select(
        `
        *,
        goal_templates (
          display_order
        )
      `
      )
      .in('startup_id', startupIds)

    if (error) {
      console.error('Database error fetching founder goals:', error)
      return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
    }

    // 6. Always create AccelerateMe goal (use template if available, otherwise use defaults)
    const accelerateMeGoal = {
      id: 'goal-join-accelerateme',
      startup_id: startupIds[0],
      goal_template_id: accelerateMeTemplate?.id || null,
      title: accelerateMeTemplate?.title || 'Join AccelerateMe',
      description:
        accelerateMeTemplate?.description || 'Welcome to the program! Your journey starts here.',
      category: accelerateMeTemplate?.category || 'launch',
      status: 'completed' as const,
      progress_value: 1,
      target_value: 1,
      weight: 0,
      funding_amount: accelerateMeTemplate?.default_funding_amount || null,
      deadline: accelerateMeTemplate?.default_deadline || null,
      manually_overridden: false,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
      goal_templates: {
        display_order: 0,
      },
    }

    // 7. Sort by display_order from goal_templates, then by created_at
    const sortedData = (data || []).sort((a, b) => {
      const aOrder =
        (a.goal_templates as { display_order: number | null } | null)?.display_order ?? null
      const bOrder =
        (b.goal_templates as { display_order: number | null } | null)?.display_order ?? null

      // If both have display_order, sort by that
      if (aOrder !== null && bOrder !== null) {
        return aOrder - bOrder
      }
      // If only one has display_order, prioritize it
      if (aOrder !== null && bOrder === null) {
        return -1
      }
      if (aOrder === null && bOrder !== null) {
        return 1
      }
      // If neither has display_order, sort by created_at
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    // 8. Always prepend AccelerateMe goal (it should always be first)
    const result = [accelerateMeGoal, ...sortedData]

    // 9. Return sorted goals data
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in GET /api/founder/goals:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
