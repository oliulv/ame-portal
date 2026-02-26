'use client'

import { useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { useWaitForUser } from '@/hooks/useWaitForUser'

export default function FounderLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, timedOut } = useWaitForUser()

  // Allow founder role, or admin/super_admin (who may also have a founderProfile).
  // Backend queries (requireFounder) handle the real access control.
  const hasFounderAccess =
    user?.role === 'founder' || user?.role === 'admin' || user?.role === 'super_admin'

  useEffect(() => {
    if (isLoading) return

    if (user && !hasFounderAccess) {
      window.location.href = '/access-required'
      return
    }

    if (!user || timedOut) {
      window.location.href = '/login'
    }
  }, [user, isLoading, timedOut, hasFounderAccess])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user || !hasFounderAccess) {
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
    <div className="flex min-h-screen bg-background">
      <Sidebar
        title="Accelerate ME"
        subtitle="Founder Portal"
        navItems={navItems}
        showCohortSelector={false}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:ml-64">
        <main className="flex-1 p-4 pt-16 lg:p-8 lg:pt-8">{children}</main>
      </div>
    </div>
  )
}
