import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { CohortAccessDenied } from '@/components/cohort-access-denied'

const RESERVED_ROUTES = [
  'cohorts',
  'startups',
  'goals',
  'invoices',
  'leaderboard',
  'new',
  'settings',
]

interface CohortSlugLayoutProps {
  children: React.ReactNode
  params: Promise<{ cohortSlug: string }>
}

export default async function CohortSlugLayout({ children, params }: CohortSlugLayoutProps) {
  const { cohortSlug } = await params

  // If this is a reserved route, it should be handled by a different route
  // Return 404 so Next.js can try the static route instead
  if (RESERVED_ROUTES.includes(cohortSlug)) {
    notFound()
  }

  // Verify this is actually a valid cohort slug
  const supabase = await createClient()
  const { data: cohort } = await supabase
    .from('cohorts')
    .select('id, slug, label, name')
    .eq('slug', cohortSlug)
    .single()

  // If not a valid cohort, return 404
  if (!cohort) {
    notFound()
  }

  // Check if admin has access to this cohort
  const user = await getCurrentUser()
  if (!user) {
    notFound()
  }

  // Super admins can access all cohorts
  if (user.role !== 'super_admin') {
    // Regular admins can only access cohorts they're assigned to
    const { data: assignment } = await supabase
      .from('admin_cohorts')
      .select('id')
      .eq('user_id', user.id)
      .eq('cohort_id', cohort.id)
      .single()

    // If admin is not assigned to this cohort, show access denied page
    if (!assignment) {
      return (
        <CohortAccessDenied
          cohortSlug={cohortSlug}
          cohortName={cohort.label || cohort.name || cohortSlug}
        />
      )
    }
  }

  return <>{children}</>
}
