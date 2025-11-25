import { NextResponse } from 'next/server'
import { requireFounder, getFounderStartupIds } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

/**
 * DELETE /api/founder/tracker-websites/[id]
 * Delete a tracker website
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireFounder()
    const startupIds = await getFounderStartupIds()

    if (startupIds.length === 0) {
      return NextResponse.json({ error: 'No startup found' }, { status: 404 })
    }

    const startupId = startupIds[0]
    const { id } = await context.params
    const supabase = createAdminClient()

    // Verify the website belongs to the founder's startup
    const { data: website, error: fetchError } = await supabase
      .from('tracker_websites')
      .select('id, startup_id')
      .eq('id', id)
      .single()

    if (fetchError || !website || website.startup_id !== startupId) {
      return NextResponse.json({ error: 'Tracker website not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase.from('tracker_websites').delete().eq('id', id)

    if (deleteError) {
      console.error('Error deleting tracker website:', deleteError)
      return NextResponse.json({ error: 'Failed to delete tracker website' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE tracker-websites:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
