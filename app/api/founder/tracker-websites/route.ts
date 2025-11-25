import { NextResponse } from 'next/server'
import { requireFounder, getFounderStartupIds } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/founder/tracker-websites
 * Get tracker websites for the founder's startup
 */
export async function GET() {
  try {
    await requireFounder()
    const startupIds = await getFounderStartupIds()

    if (startupIds.length === 0) {
      return NextResponse.json({ websites: [] })
    }

    const startupId = startupIds[0]
    const supabase = createAdminClient()

    const { data: websites, error } = await supabase
      .from('tracker_websites')
      .select('*')
      .eq('startup_id', startupId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching tracker websites:', error)
      return NextResponse.json({ error: 'Failed to fetch tracker websites' }, { status: 500 })
    }

    return NextResponse.json({ websites: websites || [] })
  } catch (error) {
    console.error('Error in GET tracker-websites:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/founder/tracker-websites
 * Create a new tracker website
 */
export async function POST(request: Request) {
  try {
    await requireFounder()
    const startupIds = await getFounderStartupIds()

    if (startupIds.length === 0) {
      return NextResponse.json({ error: 'No startup found' }, { status: 404 })
    }

    const startupId = startupIds[0]
    const body = await request.json()
    const { name, domain } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check if website with same domain already exists
    if (domain) {
      const { data: existing } = await supabase
        .from('tracker_websites')
        .select('id')
        .eq('startup_id', startupId)
        .eq('domain', domain)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'A tracker website with this domain already exists' },
          { status: 400 }
        )
      }
    }

    const { data: website, error } = await supabase
      .from('tracker_websites')
      .insert({
        startup_id: startupId,
        name,
        domain: domain || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating tracker website:', error)
      return NextResponse.json({ error: 'Failed to create tracker website' }, { status: 500 })
    }

    return NextResponse.json({ website })
  } catch (error) {
    console.error('Error in POST tracker-websites:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
