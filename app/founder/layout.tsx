'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { useWaitForUser } from '@/hooks/useWaitForUser'
import { Settings } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'

function FounderHeader() {
  const pathname = usePathname()

  return (
    <header className="hidden lg:flex items-center justify-end h-12 border-b px-6 gap-1">
      <Link
        href="/founder/settings"
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
          pathname.startsWith('/founder/settings')
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Settings className="h-3.5 w-3.5" />
        Settings
      </Link>
      <div className="ml-2 flex items-center">
        <UserButton />
      </div>
    </header>
  )
}

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
    { title: 'Perks', href: '/founder/perks', icon: 'Gift' },
    { title: 'Calendar', href: '/founder/calendar', icon: 'Calendar' },
    { title: 'Settings', href: '/founder/settings', icon: 'Settings', mobileOnly: true },
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
      <div className="flex flex-1 flex-col lg:ml-56">
        <FounderHeader />
        <main className="flex-1 p-4 pt-16 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
