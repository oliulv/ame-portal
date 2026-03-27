'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LeaderboardRedirect() {
  const params = useParams()
  const router = useRouter()
  const cohortSlug = params.cohortSlug as string

  useEffect(() => {
    router.replace(`/admin/${cohortSlug}/startups`)
  }, [cohortSlug, router])

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading...</div>
    </div>
  )
}
