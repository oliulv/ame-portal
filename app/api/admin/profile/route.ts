import { NextResponse } from 'next/server'
import { requireAdmin, getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateProfileSchema = z.object({
  email: z.string().email('Please enter a valid email address').optional(),
  full_name: z.string().min(1, 'Name is required').optional(),
})

/**
 * GET /api/admin/profile
 * Get current admin's profile
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, role, email, full_name, created_at, updated_at')
    .eq('id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * PATCH /api/admin/profile
 * Update current admin's profile (email and/or full_name)
 */
export async function PATCH(request: Request) {
  const user = await requireAdmin()

  const body = await request.json()
  const validation = updateProfileSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    )
  }

  const { email, full_name } = validation.data

  // At least one field must be provided
  if (!email && !full_name) {
    return NextResponse.json(
      { error: 'At least one field (email or full_name) must be provided' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const updateData: { email?: string; full_name?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  }

  if (email !== undefined) {
    updateData.email = email || null
  }
  if (full_name !== undefined) {
    updateData.full_name = full_name || null
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', user.id)
    .select('id, role, email, full_name, created_at, updated_at')
    .single()

  if (error) {
    console.error('Failed to update admin profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json(data)
}

