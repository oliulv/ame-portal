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

    // 3. Fetch goals from database, joined with goal_templates to get display_order
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('startup_goals')
      .select(`
        *,
        goal_templates (
          display_order
        )
      `)
      .in('startup_id', startupIds)

    if (error) {
      console.error('Database error fetching founder goals:', error)
      return NextResponse.json(
        { error: 'Failed to fetch goals' },
        { status: 500 }
      )
    }

    // 4. Sort by display_order from goal_templates, then by created_at
    const sortedData = (data || []).sort((a, b) => {
      const aOrder = (a.goal_templates as any)?.display_order ?? null
      const bOrder = (b.goal_templates as any)?.display_order ?? null
      
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

    // 5. Return sorted goals data
    return NextResponse.json(sortedData)
  } catch (error) {
    console.error('Error in GET /api/founder/goals:', error)

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

