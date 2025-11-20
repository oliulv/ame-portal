import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

/**
 * GET /api/admin/dashboard
 * Fetch dashboard statistics, optionally filtered by cohort
 */
export async function GET(request: Request) {
  try {
    // 1. Authenticate and authorize
    await requireAdmin()

    // 2. Get query parameters
    const { searchParams } = new URL(request.url)
    const cohortSlug = searchParams.get('cohort_slug')

    // 3. Fetch data from database
    const supabase = await createClient()

    let startupsQuery = supabase.from('startups').select('id', { count: 'exact', head: true })
    let invoicesQuery = supabase.from('invoices').select('id', { count: 'exact', head: true })

    // If cohort_slug is provided, filter by cohort
    if (cohortSlug) {
      // First get the cohort ID from slug
      const { data: cohort } = await supabase
        .from('cohorts')
        .select('id')
        .eq('slug', cohortSlug)
        .single()

      if (cohort) {
        // Filter startups by cohort
        startupsQuery = startupsQuery.eq('cohort_id', cohort.id)
        
        // Filter invoices by startups in this cohort
        const { data: cohortStartups } = await supabase
          .from('startups')
          .select('id')
          .eq('cohort_id', cohort.id)

        if (cohortStartups && cohortStartups.length > 0) {
          const startupIds = cohortStartups.map(s => s.id)
          invoicesQuery = invoicesQuery.in('startup_id', startupIds)
        } else {
          // No startups in cohort, so no invoices - use a query that returns 0
          invoicesQuery = supabase
            .from('invoices')
            .select('id', { count: 'exact', head: true })
            .eq('startup_id', '00000000-0000-0000-0000-000000000000') // Impossible ID to get 0 count
        }
      }
    }

    // Get counts
    const [cohortsResult, startupsResult, invoicesResult] = await Promise.all([
      supabase.from('cohorts').select('id', { count: 'exact', head: true }),
      startupsQuery,
      invoicesQuery,
    ])

    const stats = {
      cohortsCount: cohortsResult.count || 0,
      startupsCount: startupsResult.count || 0,
      invoicesCount: invoicesResult.count || 0,
    }

    // 4. Return dashboard stats
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error in GET /api/admin/dashboard:', error)

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

