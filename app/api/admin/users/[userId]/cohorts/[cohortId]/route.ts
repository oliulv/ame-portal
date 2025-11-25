import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ userId: string; cohortId: string }>
}

/**
 * DELETE /api/admin/users/[userId]/cohorts/[cohortId]
 * Remove an admin from a cohort
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireSuperAdmin()
    const { userId, cohortId } = await context.params

    const supabase = await createClient()

    // Verify assignment exists
    const { data: assignment, error: assignmentError } = await supabase
      .from('admin_cohorts')
      .select('id')
      .eq('user_id', userId)
      .eq('cohort_id', cohortId)
      .single()

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Delete assignment
    const { error } = await supabase
      .from('admin_cohorts')
      .delete()
      .eq('user_id', userId)
      .eq('cohort_id', cohortId)

    if (error) {
      console.error('Database error removing admin from cohort:', error)
      return NextResponse.json({ error: 'Failed to remove admin from cohort' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error in DELETE /api/admin/users/[userId]/cohorts/[cohortId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

