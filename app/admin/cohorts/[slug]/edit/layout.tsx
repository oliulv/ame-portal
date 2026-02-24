'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

export default function EditCohortLayout({ children }: { children: React.ReactNode }) {
  const user = useQuery(api.users.current)

  if (user === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (user?.role !== 'super_admin') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Access denied. Super admin required.</div>
      </div>
    )
  }

  return <>{children}</>
}
