'use client'

import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Sidebar } from '@/components/sidebar'

export default function FounderLayout({ children }: { children: React.ReactNode }) {
  const user = useQuery(api.users.current)
  const [waitCount, setWaitCount] = useState(0)

  useEffect(() => {
    if (user === undefined) return

    if (user && user.role !== 'founder') {
      window.location.href = '/access-required'
      return
    }

    if (!user) {
      if (waitCount < 10) {
        const timer = setTimeout(() => setWaitCount((c) => c + 1), 500)
        return () => clearTimeout(timer)
      }
      window.location.href = '/login'
    }
  }, [user, waitCount])

  if (user === undefined || (!user && waitCount < 10)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user || user.role !== 'founder') {
    return null
  }

  const navItems = [
    { title: 'Dashboard', href: '/founder/dashboard', icon: 'LayoutDashboard' },
    { title: 'Goals', href: '/founder/goals', icon: 'Target' },
    { title: 'Analytics', href: '/founder/analytics', icon: 'TrendingUp' },
    { title: 'Invoices', href: '/founder/invoices', icon: 'FileText' },
    { title: 'Settings', href: '/founder/settings', icon: 'Settings' },
  ]

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar
        title="AccelerateMe"
        subtitle="Founder Portal"
        navItems={navItems}
        showCohortSelector={false}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-6 lg:px-6">
          <h2 className="ml-12 text-lg font-semibold lg:ml-0">Founder Portal</h2>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
