'use client'

import { useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { useWaitForUser } from '@/hooks/useWaitForUser'

export default function FounderLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, timedOut } = useWaitForUser()

  useEffect(() => {
    if (isLoading) return

    if (user && user.role !== 'founder') {
      window.location.href = '/access-required'
      return
    }

    if (!user || timedOut) {
      window.location.href = '/login'
    }
  }, [user, isLoading, timedOut])

  if (isLoading) {
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
    { title: 'Funding', href: '/founder/funding', icon: 'Target' },
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
