import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateGoalForStartup } from '@/lib/services/goals'

/**
 * POST /api/cron/check-goal-progress
 * Background job to check and update goal progress based on metrics
 * Protected by CRON_SECRET header
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('CRON_SECRET not configured')
      return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Fetch all active goals that have metric-based tracking
    // (either via goal_template_id with conditions, or direct data_source/metric_key)
    const { data: goals, error: goalsError } = await supabase
      .from('startup_goals')
      .select('*')
      .in('status', ['not_started', 'in_progress'])
      .eq('manually_overridden', false)
      .or('data_source.not.is.null,goal_template_id.not.is.null')

    if (goalsError) {
      console.error('Error fetching goals:', goalsError)
      return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
    }

    if (!goals || goals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No metric-based goals to check',
        checked: 0,
      })
    }

    let checkedCount = 0
    let updatedCount = 0
    const errors: Array<{ goalId: string; error: string }> = []

    // Check each goal
    for (const goal of goals) {
      try {
        // Skip if goal doesn't have metric configuration
        if (!goal.data_source && !goal.goal_template_id) {
          continue
        }

        const evaluation = await evaluateGoalForStartup(goal.id)
        checkedCount++

        if (evaluation.shouldUpdate && evaluation.newStatus) {
          // Update goal status
          const updateData: Record<string, unknown> = {
            status: evaluation.newStatus,
            progress_value: Math.round(evaluation.progress * 100),
            last_metric_check_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          if (evaluation.newStatus === 'completed') {
            updateData.completed_at = new Date().toISOString()
            updateData.completion_source = 'auto'
          } else if (evaluation.newStatus === 'in_progress' && goal.status === 'completed') {
            // If uncompleting, clear completion fields
            updateData.completed_at = null
            updateData.completion_source = null
          }

          const { error: updateError } = await supabase
            .from('startup_goals')
            .update(updateData)
            .eq('id', goal.id)

          if (updateError) {
            console.error(`Error updating goal ${goal.id}:`, updateError)
            errors.push({
              goalId: goal.id,
              error: updateError.message,
            })
          } else {
            updatedCount++

            // Create goal update record for audit trail
            // Note: user_id is required but we don't have a system user
            // For now, we'll skip creating goal_updates records for automated completions
            // In production, you might want to create a system user or make user_id nullable
            // if (evaluation.newStatus === 'completed') {
            //   await supabase.from('goal_updates').insert({
            //     startup_goal_id: goal.id,
            //     previous_status: goal.status,
            //     new_status: 'completed',
            //     previous_progress: goal.progress_value,
            //     new_progress: Math.round(evaluation.progress * 100),
            //     comment: `Auto-completed: metric-based condition met (progress: ${Math.round(evaluation.progress * 100)}%)`,
            //     user_id: 'system', // Would need a system user ID
            //   })
            // }
          }
        } else {
          // Update progress even if status doesn't change
          const newProgress = Math.round(evaluation.progress * 100)
          if (newProgress !== goal.progress_value) {
            await supabase
              .from('startup_goals')
              .update({
                progress_value: newProgress,
                last_metric_check_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', goal.id)
          }
        }
      } catch (error) {
        console.error(`Error checking goal ${goal.id}:`, error)
        errors.push({
          goalId: goal.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      checked: checkedCount,
      updated: updatedCount,
      total: goals.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error in check-goal-progress cron:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/cron/check-goal-progress
 * Allow manual triggering for testing (still requires auth)
 */
export async function GET(request: Request) {
  return POST(request)
}
