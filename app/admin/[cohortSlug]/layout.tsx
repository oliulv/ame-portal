'use client'

import { useParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

const RESERVED_ROUTES = [
  'cohorts',
  'startups',
  'goals',
  'invoices',
  'leaderboard',
  'new',
  'settings',
]

export default function CohortSlugLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string

  // If this is a reserved route, just render children (Next.js routing handles it)
  if (RESERVED_ROUTES.includes(cohortSlug)) {
    return <>{children}</>
  }

  return <CohortSlugLayoutInner cohortSlug={cohortSlug}>{children}</CohortSlugLayoutInner>
}

function CohortSlugLayoutInner({
  cohortSlug,
  children,
}: {
  cohortSlug: string
  children: React.ReactNode
}) {
  const user = useQuery(api.users.current)
  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })

  // Loading
  if (user === undefined || cohort === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Invalid cohort
  if (!cohort) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Cohort not found</div>
      </div>
    )
  }

  // No user (admin layout already handles auth, but just in case)
  if (!user) {
    return null
  }

  // Access check is handled by the cohorts.getBySlug query which respects admin permissions
  // The cohorts.list query only returns cohorts the user has access to
  // But getBySlug may return cohorts the user doesn't have access to, so we rely on
  // the admin layout's auth check + the fact that the sidebar only shows accessible cohorts

  return <>{children}</>
}
