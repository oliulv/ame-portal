import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

/**
 * PATCH /api/admin/goals/reorder
 * Reorder goal templates by updating their display_order values
 */
export async function PATCH(request: Request) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // 2. Parse request body - expects array of { id: string, display_order: number }
    const body = await request.json()
    const { goalIds } = body

    if (!Array.isArray(goalIds) || goalIds.length === 0) {
      return NextResponse.json(
        { error: 'goalIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // 3. Update display_order for each goal template
    const supabase = await createClient()
    
    // Use a transaction-like approach: update each goal with its new order
    const updates = goalIds.map((id: string, index: number) => ({
      id,
      display_order: index + 1,
    }))

    // Update all goals in parallel
    const updatePromises = updates.map(({ id, display_order }) =>
      supabase
        .from('goal_templates')
        .update({ display_order })
        .eq('id', id)
    )

    const results = await Promise.all(updatePromises)
    
    // Check for errors
    const errors = results.filter((result) => result.error)
    if (errors.length > 0) {
      console.error('Database errors updating goal order:', errors)
      return NextResponse.json(
        { error: 'Failed to update goal order' },
        { status: 500 }
      )
    }

    // 4. Return success response
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PATCH /api/admin/goals/reorder:', error)

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

