'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { useWaitForUser } from '@/hooks/useWaitForUser'
import { Users, Settings } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'

function AdminHeader({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  const [cohortSlug, setCohortSlug] = useState<string | null>(null)

  useEffect(() => {
    const match = pathname.match(/^\/admin\/([^/]+)(?:\/|$)/)
    if (match && match[1] && match[1] !== 'cohorts' && match[1] !== 'settings') {
      setCohortSlug(match[1])
      return
    }
    setCohortSlug(localStorage.getItem('selectedCohortSlug'))
  }, [pathname])

  const adminsHref = cohortSlug ? `/admin/${cohortSlug}/admins` : '#'

  return (
    <header className="hidden h-12 shrink-0 items-center justify-end gap-1 border-b bg-background px-6 lg:flex">
      {userRole === 'super_admin' && (
        <Link
          href={adminsHref}
          className={cn(
            'flex items-center gap-1.5  px-2.5 py-1.5 text-xs font-medium transition-colors',
            pathname.includes('/admins')
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="h-3.5 w-3.5" />
          Admins
        </Link>
      )}
      <Link
        href="/admin/settings"
        className={cn(
          'flex items-center gap-1.5  px-2.5 py-1.5 text-xs font-medium transition-colors',
          pathname.startsWith('/admin/settings')
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
      <div className="flex h-[100dvh] items-center justify-center bg-background">
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
      ? [{ title: 'Admins', href: '/admin/admins', icon: 'Users', mobileOnly: true }]
      : []),
    { title: 'Settings', href: '/admin/settings', icon: 'Settings', mobileOnly: true },
  ]

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-background">
      <Sidebar
        title="Accelerate ME"
        subtitle="Admin Portal"
        navItems={navItems}
        showCohortSelector={true}
        userRole={user.role}
      />

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col lg:ml-56">
        <AdminHeader userRole={user.role} />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-none p-4 pt-16 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
