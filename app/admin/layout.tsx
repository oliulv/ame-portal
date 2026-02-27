'use client'

import { useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { useWaitForUser } from '@/hooks/useWaitForUser'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, timedOut } = useWaitForUser()

  useEffect(() => {
    if (isLoading) return

    if (user && user.role !== 'admin' && user.role !== 'super_admin') {
      window.location.href = '/access-required'
      return
    }

    if (!user || timedOut) {
      window.location.href = '/login'
    }
  }, [user, isLoading, timedOut])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return null
  }

  const navItems = [
    { title: 'Dashboard', href: '/admin', icon: 'LayoutDashboard' },
    { title: 'Startups', href: '/admin/startups', icon: 'Building2' },
    { title: 'Funding', href: '/admin/funding', icon: 'Target' },
    { title: 'Invoices', href: '/admin/invoices', icon: 'FileText' },
    { title: 'Perks', href: '/admin/perks', icon: 'Gift' },
    { title: 'Events', href: '/admin/events', icon: 'Calendar' },
    { title: 'Leaderboard', href: '/admin/leaderboard', icon: 'Trophy' },
    ...(user.role === 'super_admin'
      ? [{ title: 'Admins', href: '/admin/admins', icon: 'Users' }]
      : []),
    { title: 'Settings', href: '/admin/settings', icon: 'Settings' },
  ]

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        title="Accelerate ME"
        subtitle="Admin Portal"
        navItems={navItems}
        showCohortSelector={true}
        userRole={user.role}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:ml-64">
        <main className="flex-1 p-4 pt-16 lg:p-8 lg:pt-8">{children}</main>
      </div>
    </div>
  )
}
