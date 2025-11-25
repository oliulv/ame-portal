import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ userId: string }>
}

/**
 * POST /api/admin/users/[userId]/cohorts
 * Assign an admin to a cohort
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    await requireSuperAdmin()
    const { userId } = await context.params
    const body = await request.json()

    const cohortId = typeof body.cohort_id === 'string' ? body.cohort_id.trim() : null

    if (!cohortId) {
      return NextResponse.json({ error: 'cohort_id is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify user exists and is an admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .in('role', ['admin', 'super_admin'])
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found or not an admin' }, { status: 404 })
    }

    // Verify cohort exists
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .select('id')
      .eq('id', cohortId)
      .single()

    if (cohortError || !cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 })
    }

    // Check if assignment already exists
    const { data: existing } = await supabase
      .from('admin_cohorts')
      .select('id')
      .eq('user_id', userId)
      .eq('cohort_id', cohortId)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Admin is already assigned to this cohort' },
        { status: 400 }
      )
    }

    // Create assignment
    const { data: assignment, error } = await supabase
      .from('admin_cohorts')
      .insert({
        user_id: userId,
        cohort_id: cohortId,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error assigning admin to cohort:', error)
      return NextResponse.json({ error: 'Failed to assign admin to cohort' }, { status: 500 })
    }

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/users/[userId]/cohorts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
