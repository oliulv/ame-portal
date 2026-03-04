'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Sidebar } from '@/components/sidebar'
import { useWaitForUser } from '@/hooks/useWaitForUser'
import { Settings } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'

function FounderHeader() {
  const pathname = usePathname()

  return (
    <header
      className="hidden h-12 shrink-0 border-b bg-background lg:block"
      style={{ borderBottomColor: 'hsl(var(--border-strong))' }}
    >
      <div className="flex h-full items-center justify-end gap-1 px-6 lg:ml-56">
        <Link
          href="/founder/settings"
          className={cn(
            'flex items-center gap-1.5  px-2.5 py-1.5 text-xs font-medium transition-colors',
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
      </div>
    </header>
  )
}

export default function FounderLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading, timedOut } = useWaitForUser()

  // Allow founder role, or admin/super_admin (who may also have a founderProfile).
  // Backend queries (requireFounder) handle the real access control.
  const hasFounderAccess =
    user?.role === 'founder' || user?.role === 'admin' || user?.role === 'super_admin'

  const profileData = useQuery(api.founderProfile.get, hasFounderAccess ? undefined : 'skip')
  const onboardingIncomplete =
    profileData !== undefined && profileData?.founderProfile?.onboardingStatus !== 'completed'

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

  // Redirect non-onboarded founders to onboarding page
  useEffect(() => {
    if (!onboardingIncomplete) return
    if (pathname.startsWith('/founder/onboarding')) return
    router.replace('/founder/onboarding')
  }, [onboardingIncomplete, pathname, router])

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
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
    <div className="fixed inset-0 overflow-hidden bg-background">
      <Sidebar
        title="Accelerate ME"
        subtitle="Founder Portal"
        navItems={navItems}
        showCohortSelector={false}
        navigationDisabled={onboardingIncomplete}
      />

      {/* Main content */}
      <div className="flex h-full flex-col">
        <FounderHeader />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-none p-4 pt-16 lg:ml-56 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
