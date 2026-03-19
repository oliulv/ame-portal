'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

/**
 * Redirects to a cohort-scoped admin page (e.g. /admin/{slug}/startups).
 * Falls back to /admin/cohorts when no cohorts exist.
 */
export function AdminCohortRedirect({ subpath }: { subpath: string }) {
  const router = useRouter()
  const cohorts = useQuery(api.cohorts.list)

  useEffect(() => {
    if (cohorts === undefined) return
    if (!cohorts || cohorts.length === 0) {
      router.replace('/admin/cohorts')
      return
    }
    const slug = (cohorts.find((c) => c.isActive) ?? cohorts[0])?.slug
    if (slug) {
      router.replace(`/admin/${slug}/${subpath}`)
    } else {
      router.replace('/admin/cohorts')
    }
  }, [cohorts, router, subpath])

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading...</div>
    </div>
  )
}
