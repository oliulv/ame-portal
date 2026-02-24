'use client'

import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Sidebar } from '@/components/sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useQuery(api.users.current)
  const [waitCount, setWaitCount] = useState(0)

  useEffect(() => {
    if (user === undefined) return // still loading

    if (user && user.role !== 'admin' && user.role !== 'super_admin') {
      // Wrong role — redirect
      window.location.href = '/access-required'
      return
    }

    if (!user) {
      // No user record yet — ensureUser may still be creating it.
      // Wait for the reactive query to update.
      if (waitCount < 10) {
        const timer = setTimeout(() => setWaitCount((c) => c + 1), 500)
        return () => clearTimeout(timer)
      }
      // After 5 seconds, redirect
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

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return null
  }

  const navItems = [
    { title: 'Dashboard', href: '/admin', icon: 'LayoutDashboard' },
    { title: 'Startups', href: '/admin/startups', icon: 'Building2' },
    { title: 'Goal Templates', href: '/admin/goals', icon: 'Target' },
    { title: 'Invoices', href: '/admin/invoices', icon: 'FileText' },
    { title: 'Leaderboard', href: '/admin/leaderboard', icon: 'Trophy' },
    ...(user.role === 'super_admin'
      ? [{ title: 'Admins', href: '/admin/admins', icon: 'Users' }]
      : []),
    { title: 'Settings', href: '/admin/settings', icon: 'Settings' },
  ]

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar
        title="AccelerateMe"
        subtitle="Admin Portal"
        navItems={navItems}
        showCohortSelector={true}
        userRole={user.role}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-6">
          <h2 className="ml-12 text-lg font-semibold lg:ml-0">Admin Portal</h2>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
