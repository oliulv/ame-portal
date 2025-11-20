import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

/**
 * POST /api/admin/goals/cleanup-duplicates
 * Remove duplicate "Join AccelerateMe" goals, keeping only the first one per cohort
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // 2. Parse request body to optionally specify cohort_id
    let cohortId: string | null = null
    try {
      const body = await request.json().catch(() => ({}))
      cohortId = body.cohort_id || null
    } catch {
      // No body provided, clean up all cohorts
    }

    // 3. Fetch all "Join AccelerateMe" goals
    const supabase = await createClient()
    let query = supabase
      .from('goal_templates')
      .select('id, cohort_id, title, created_at')
      .or('title.eq.Join AccelerateMe,title.ilike.%join accelerateme%')
      .order('created_at', { ascending: true })

    if (cohortId) {
      query = query.eq('cohort_id', cohortId)
    }

    const { data: accelerateMeGoals, error: fetchError } = await query

    if (fetchError) {
      console.error('Database error fetching duplicate goals:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch goals' },
        { status: 500 }
      )
    }

    if (!accelerateMeGoals || accelerateMeGoals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No duplicate "Join AccelerateMe" goals found',
        deleted: 0,
      })
    }

    // 4. Group by cohort_id and identify duplicates
    const goalsByCohort = new Map<string, typeof accelerateMeGoals>()
    for (const goal of accelerateMeGoals) {
      const cohort = goal.cohort_id || 'null'
      if (!goalsByCohort.has(cohort)) {
        goalsByCohort.set(cohort, [])
      }
      goalsByCohort.get(cohort)!.push(goal)
    }

    // 5. For each cohort, keep the first goal and mark others for deletion
    const goalsToDelete: string[] = []
    const keptGoals: Array<{ id: string; cohort_id: string | null }> = []

    for (const [cohortId, goals] of goalsByCohort.entries()) {
      if (goals.length > 1) {
        // Sort by created_at to keep the oldest one
        const sorted = [...goals].sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
          return aTime - bTime
        })

        // Keep the first one
        keptGoals.push({
          id: sorted[0].id,
          cohort_id: sorted[0].cohort_id,
        })

        // Mark the rest for deletion
        for (let i = 1; i < sorted.length; i++) {
          goalsToDelete.push(sorted[i].id)
        }
      } else {
        // Only one goal, keep it
        keptGoals.push({
          id: goals[0].id,
          cohort_id: goals[0].cohort_id,
        })
      }
    }

    // 6. Delete duplicate goals
    let deletedCount = 0
    if (goalsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('goal_templates')
        .delete()
        .in('id', goalsToDelete)

      if (deleteError) {
        console.error('Database error deleting duplicate goals:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete duplicate goals', details: deleteError },
          { status: 500 }
        )
      }

      deletedCount = goalsToDelete.length
    }

    // 7. Return success response
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} duplicate "Join AccelerateMe" goal(s)`,
      deleted: deletedCount,
      kept: keptGoals.length,
      details: {
        deletedIds: goalsToDelete,
        keptIds: keptGoals.map((g) => g.id),
      },
    })
  } catch (error) {
    console.error('Error in POST /api/admin/goals/cleanup-duplicates:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

