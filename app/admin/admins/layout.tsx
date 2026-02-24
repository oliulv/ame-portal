'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

export default function AdminsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user = useQuery(api.users.current)
  const cohorts = useQuery(api.cohorts.list)

  useEffect(() => {
    if (user === undefined || cohorts === undefined) return
    if (user?.role !== 'super_admin') {
      router.replace('/admin')
      return
    }
    if (!cohorts || cohorts.length === 0) {
      router.replace('/admin/cohorts')
      return
    }
    const activeCohort = cohorts.find((c) => c.isActive)
    const slug = activeCohort?.slug || cohorts[0]?.slug
    if (slug) {
      router.replace(`/admin/${slug}/admins`)
    }
  }, [user, cohorts, router])

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
