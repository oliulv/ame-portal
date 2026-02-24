'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

export default function StartupsRedirect() {
  const router = useRouter()
  const cohorts = useQuery(api.cohorts.list)

  useEffect(() => {
    if (cohorts === undefined) return // still loading
    if (!cohorts || cohorts.length === 0) {
      router.replace('/admin/cohorts')
      return
    }
    const activeCohort = cohorts.find((c) => c.isActive)
    const slug = activeCohort?.slug || cohorts[0]?.slug
    if (slug) {
      router.replace(`/admin/${slug}/startups`)
    } else {
      router.replace('/admin/cohorts')
    }
  }, [cohorts, router])

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading...</div>
    </div>
  )
}
