'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { CohortsPageClient } from './cohorts-page-client'

export default function CohortsPage() {
  const user = useQuery(api.users.current)
  const isSuperAdmin = user?.role === 'super_admin'

  if (user === undefined) {
    return null
  }

  return <CohortsPageClient isSuperAdmin={isSuperAdmin} />
}
