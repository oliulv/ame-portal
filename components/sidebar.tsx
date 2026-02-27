'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Target,
  FileText,
  Trophy,
  Menu,
  LucideIcon,
  Building2,
  Plus,
  Settings,
  TrendingUp,
  Gift,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserButton } from '@clerk/nextjs'

interface NavItem {
  title: string
  href: string
  icon: string
}

interface SidebarProps {
  title: string
  subtitle: string
  navItems: NavItem[]
  showCohortSelector?: boolean
  userRole?: 'super_admin' | 'admin' | 'founder'
}

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard: LayoutDashboard,
  Users: Users,
  Target: Target,
  FileText: FileText,
  Trophy: Trophy,
  Building2: Building2,
  Settings: Settings,
  TrendingUp: TrendingUp,
  Gift: Gift,
}

function extractCohortSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/([^/]+)(?:\/|$)/)
  if (match && match[1]) {
    const slug = match[1]
    const excludedRoutes = [
      'cohorts',
      'startups',
      'goals',
      'invoices',
      'leaderboard',
      'new',
      'settings',
      'perks',
    ]
    if (!excludedRoutes.includes(slug)) {
      return slug
    }
  }
  return null
}

function buildNavHref(baseHref: string, cohortSlug: string | null): string {
  const globalRoutes = ['/admin/cohorts', '/admin/settings']
  if (globalRoutes.includes(baseHref)) {
    return baseHref
  }

  const cohortScopedRoutes = [
    '/admin',
    '/admin/funding',
    '/admin/startups',
    '/admin/invoices',
    '/admin/leaderboard',
    '/admin/admins',
    '/admin/perks',
    '/admin/events',
  ]

  const validCohortSlug = cohortSlug && cohortSlug !== '' ? cohortSlug : null

  if (cohortScopedRoutes.includes(baseHref) && !validCohortSlug) {
    return '#'
  }

  if (!validCohortSlug) return baseHref

  const routeMap: Record<string, string> = {
    '/admin': `/admin/${validCohortSlug}`,
    '/admin/funding': `/admin/${validCohortSlug}/funding`,
    '/admin/startups': `/admin/${validCohortSlug}/startups`,
    '/admin/invoices': `/admin/${validCohortSlug}/invoices`,
    '/admin/leaderboard': `/admin/${validCohortSlug}/leaderboard`,
    '/admin/admins': `/admin/${validCohortSlug}/admins`,
    '/admin/perks': `/admin/${validCohortSlug}/perks`,
    '/admin/events': `/admin/${validCohortSlug}/events`,
  }

  return routeMap[baseHref] || baseHref
}

function SidebarContent({
  title,
  subtitle,
  navItems,
  showCohortSelector = false,
  userRole,
  onLinkClick,
}: SidebarProps & { onLinkClick?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const [selectedCohortSlug, setSelectedCohortSlug] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  const cohortsData = useQuery(api.cohorts.list, showCohortSelector ? undefined : 'skip')
  const cohorts = cohortsData ?? []
  const isLoadingCohorts = cohortsData === undefined && showCohortSelector

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!showCohortSelector || cohorts.length === 0) return

    const urlCohortSlug = extractCohortSlugFromPath(pathname)

    if (urlCohortSlug && cohorts.find((c) => c.slug === urlCohortSlug)) {
      setSelectedCohortSlug(urlCohortSlug)
      if (mounted) {
        localStorage.setItem('selectedCohortSlug', urlCohortSlug)
      }
      return
    }

    if (!mounted) {
      const activeCohort = cohorts.find((c) => c.isActive) || cohorts[0]
      if (activeCohort) {
        setSelectedCohortSlug(activeCohort.slug)
      }
      return
    }

    let resolvedSlug: string | null = null
    const storedCohortSlug = localStorage.getItem('selectedCohortSlug')

    if (storedCohortSlug && cohorts.find((c) => c.slug === storedCohortSlug)) {
      resolvedSlug = storedCohortSlug
    } else {
      const activeCohort = cohorts.find((c) => c.isActive) || cohorts[0]
      if (activeCohort) {
        resolvedSlug = activeCohort.slug
      }
    }

    if (resolvedSlug) {
      setSelectedCohortSlug(resolvedSlug)
      localStorage.setItem('selectedCohortSlug', resolvedSlug)

      const globalRoutePrefixes = ['/admin/settings', '/admin/cohorts']
      const isGlobalRoute = globalRoutePrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
      )

      if (!urlCohortSlug && pathname.startsWith('/admin') && !isGlobalRoute) {
        if (pathname === '/admin' || pathname === '/admin/') {
          router.replace(`/admin/${resolvedSlug}`)
        } else {
          const subPath = pathname.replace(/^\/admin/, '')
          router.replace(`/admin/${resolvedSlug}${subPath}`)
        }
      }
    }
  }, [showCohortSelector, cohorts, pathname, mounted, router])

  const handleCohortChange = (newCohortSlug: string) => {
    setSelectedCohortSlug(newCohortSlug)
    localStorage.setItem('selectedCohortSlug', newCohortSlug)

    const urlCohortSlug = extractCohortSlugFromPath(pathname)
    let newPath = pathname

    if (urlCohortSlug) {
      newPath = pathname.replace(`/admin/${urlCohortSlug}`, `/admin/${newCohortSlug}`)
    } else {
      newPath = `/admin/${newCohortSlug}`
    }

    router.push(newPath)
    window.dispatchEvent(new Event('cohortChanged'))
  }

  const selectedCohort = cohorts.find((c) => c.slug === selectedCohortSlug)
  const urlCohortSlug = extractCohortSlugFromPath(pathname)
  const currentCohortSlug =
    urlCohortSlug || (selectedCohortSlug && selectedCohortSlug !== '' ? selectedCohortSlug : null)

  const allNavItems = navItems

  const renderNavItem = (item: NavItem) => {
    let cohortSlugForHref: string | null = null

    if (currentCohortSlug && currentCohortSlug !== '') {
      cohortSlugForHref = currentCohortSlug
    } else if (selectedCohortSlug && selectedCohortSlug !== '') {
      cohortSlugForHref = selectedCohortSlug
    } else if (cohorts.length > 0) {
      const defaultCohort = cohorts.find((c) => c.isActive) || cohorts[0]
      cohortSlugForHref = defaultCohort?.slug || null
    }

    const href = buildNavHref(item.href, cohortSlugForHref)

    const isActive =
      item.href === '/admin'
        ? pathname === href ||
          (pathname.startsWith(`/admin/${currentCohortSlug}/`) &&
            !pathname.match(
              /^\/admin\/[^/]+\/(goals|startups|invoices|leaderboard|funding|admins|perks)/
            ))
        : pathname === href || pathname.startsWith(href + '/')
    const Icon = iconMap[item.icon] || LayoutDashboard

    const needsCohortSlug =
      showCohortSelector &&
      !cohortSlugForHref &&
      (item.href === '/admin' ||
        item.href === '/admin/invoices' ||
        item.href === '/admin/leaderboard' ||
        item.href === '/admin/goals' ||
        item.href === '/admin/startups' ||
        item.href === '/admin/admins' ||
        item.href === '/admin/perks')
    const isDisabled = (needsCohortSlug && isLoadingCohorts) || href === '#'

    return (
      <Link
        key={item.href}
        href={isDisabled ? '#' : href}
        onClick={(e) => {
          if (isDisabled || href === '#') {
            e.preventDefault()
            return
          }
          onLinkClick?.()
        }}
        className={cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-sidebar-active text-sidebar-active-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-active-foreground',
          isDisabled && 'pointer-events-none opacity-40'
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {item.title}
      </Link>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="px-5 pt-5 pb-3 border-b border-sidebar-border">
        <h1 className="text-lg font-semibold tracking-tight text-sidebar-active-foreground">
          {title}
        </h1>
        <p className="mt-0.5 text-xs text-sidebar-muted">{subtitle}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 pt-3 overflow-y-auto">
        {allNavItems.map(renderNavItem)}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto">
        {/* Cohort selector (admin only) */}
        {showCohortSelector && (
          <div className="px-3 pb-3">
            <label className="mb-1.5 block px-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">
              Cohort
            </label>
            {!mounted || isLoadingCohorts ? (
              <div className="h-9 rounded-lg bg-sidebar-active animate-pulse" />
            ) : (
              <Select value={currentCohortSlug || ''} onValueChange={handleCohortChange}>
                <SelectTrigger className="w-full rounded-lg border-sidebar-border bg-sidebar-active text-sidebar-active-foreground text-sm h-9 focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="Select cohort">
                    {selectedCohort ? selectedCohort.label : 'Select cohort'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-lg border-sidebar-border bg-[hsl(0,0%,11%)]">
                  {cohorts.map((cohort) => (
                    <SelectItem
                      key={cohort._id}
                      value={cohort.slug}
                      className="text-[hsl(0,0%,90%)] focus:bg-[hsl(0,0%,16%)] focus:text-white rounded-md"
                    >
                      {cohort.label} ({cohort.yearStart} - {cohort.yearEnd})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {userRole === 'super_admin' && (
              <Link href="/admin/cohorts/new" onClick={onLinkClick} className="mt-2 block">
                <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-sidebar-border px-3 py-1.5 text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-hover hover:text-sidebar-active-foreground">
                  <Plus className="h-3.5 w-3.5" />
                  New Cohort
                </button>
              </Link>
            )}
          </div>
        )}

        {/* User area */}
        <div className="border-t border-sidebar-border px-4 py-3">
          <div className="flex items-center gap-3">
            {mounted && <UserButton />}
            <span className="text-[11px] text-sidebar-muted">Accelerate ME</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({
  title,
  subtitle,
  navItems,
  showCohortSelector = false,
  userRole,
}: SidebarProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile menu */}
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed left-4 top-4 z-40 lg:hidden bg-sidebar text-sidebar-active-foreground hover:bg-sidebar-active"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
            <SheetHeader className="sr-only">
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <SidebarContent
              title={title}
              subtitle={subtitle}
              navItems={navItems}
              showCohortSelector={showCohortSelector}
              userRole={userRole}
              onLinkClick={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden fixed left-0 top-0 z-30 h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarContent
          title={title}
          subtitle={subtitle}
          navItems={navItems}
          showCohortSelector={showCohortSelector}
          userRole={userRole}
        />
      </aside>
    </>
  )
}
