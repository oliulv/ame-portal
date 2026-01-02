import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startupSchema } from '@/lib/schemas'
import { requireAdmin } from '@/lib/auth'
import { invalidateStartup } from '@/lib/cache/invalidate'

interface RouteContext {
  params: Promise<{
    slug: string
  }>
}

/**
 * GET /api/admin/startups/[slug]
 * Fetch a single startup by slug
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // Get the startup slug from params
    const { slug } = await context.params

    // 2. Fetch startup from database by slug
    const supabase = await createClient()
    const { data, error } = await supabase.from('startups').select('*').eq('slug', slug).single()

    if (error || !data) {
      return NextResponse.json({ error: 'Startup not found' }, { status: 404 })
    }

    // 3. Return startup data
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/admin/startups/[slug]:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/startups/[slug]
 * Update an existing startup
 * Note: Slug is kept stable even if name changes for URL consistency
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // Get the startup slug from params
    const { slug } = await context.params

    // 2. Parse and validate request body
    const body = await request.json()
    const validatedData = startupSchema.parse(body)

    // 3. Check if slug is being updated and validate uniqueness
    const supabase = await createClient()
    let newSlug = slug // Default to current slug

    if (validatedData.slug && validatedData.slug !== slug) {
      // Check if new slug already exists
      const { data: existingStartup } = await supabase
        .from('startups')
        .select('id')
        .eq('slug', validatedData.slug)
        .single()

      if (existingStartup) {
        return NextResponse.json(
          { error: 'A startup with this slug already exists' },
          { status: 400 }
        )
      }
      newSlug = validatedData.slug
    }

    // 4. Update startup in database
    const updateData: {
      name: string
      cohort_id: string
      logo_url: string | null
      sector?: string | null
      stage?: string | null
      website_url?: string | null
      slug?: string
      notes?: string | null
    } = {
      name: validatedData.name,
      cohort_id: validatedData.cohort_id,
      logo_url: validatedData.logo_url || null,
      sector: validatedData.sector || null,
      stage: validatedData.stage || null,
      website_url: validatedData.website_url || null,
      notes: validatedData.notes || null,
      slug: newSlug,
    }

    // Only update slug if it's provided and different
    if (validatedData.slug && validatedData.slug !== slug) {
      updateData.slug = validatedData.slug
    }

    const { data, error } = await supabase
      .from('startups')
      .update(updateData)
      .eq('slug', slug)
      .select()
      .single()

    if (error) {
      console.error('Database error updating startup:', error)
      return NextResponse.json({ error: 'Failed to update startup' }, { status: 500 })
    }

    // 5. Invalidate cache for this startup
    await invalidateStartup(slug)
    if (newSlug !== slug) {
      await invalidateStartup(newSlug)
    }

    // 6. Return success response with new slug if changed
    return NextResponse.json({ ...data, slug_changed: newSlug !== slug, new_slug: newSlug })
  } catch (error) {
    console.error('Error in PATCH /api/admin/startups/[slug]:', error)

    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error }, { status: 400 })
    }

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
