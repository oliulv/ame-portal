import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { z } from 'zod'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

/**
 * Schema for updating a startup goal
 */
const updateStartupGoalSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  category: z
    .enum(['launch', 'revenue', 'users', 'product', 'fundraising', 'growth', 'hiring'])
    .optional(),
  target_value: z.number().optional(),
  deadline: z.string().optional(),
  weight: z.number().min(0).optional(),
  funding_amount: z.number().min(0).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  progress_value: z.number().min(0).max(100).optional(),
})

/**
 * PATCH /api/admin/startup-goals/[id]
 * Update a startup-specific goal
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // Get the goal ID from params
    const { id } = await context.params

    // 2. Parse and validate request body
    const body = await request.json()
    const validatedData = updateStartupGoalSchema.parse(body)

    // 3. Update startup goal in database
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('startup_goals')
      .update({
        ...validatedData,
        manually_overridden: true, // Mark as manually overridden when admin edits
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error updating startup goal:', error)
      return NextResponse.json({ error: 'Failed to update startup goal' }, { status: 500 })
    }

    // 4. Return success response
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PATCH /api/admin/startup-goals/[id]:', error)

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/startup-goals/[id]
 * Delete a startup-specific goal
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // Get the goal ID from params
    const { id } = await context.params

    // 2. Delete startup goal from database
    const supabase = await createClient()
    const { error } = await supabase.from('startup_goals').delete().eq('id', id)

    if (error) {
      console.error('Database error deleting startup goal:', error)
      return NextResponse.json({ error: 'Failed to delete startup goal' }, { status: 500 })
    }

    // 3. Return success response
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/admin/startup-goals/[id]:', error)

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
