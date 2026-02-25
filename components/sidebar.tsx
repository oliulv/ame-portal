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

    const storedCohortSlug = localStorage.getItem('selectedCohortSlug')

    if (storedCohortSlug && cohorts.find((c) => c.slug === storedCohortSlug)) {
      setSelectedCohortSlug(storedCohortSlug)
    } else {
      const activeCohort = cohorts.find((c) => c.isActive) || cohorts[0]
      if (activeCohort) {
        setSelectedCohortSlug(activeCohort.slug)
        localStorage.setItem('selectedCohortSlug', activeCohort.slug)
      }
    }
  }, [showCohortSelector, cohorts, pathname, mounted])

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 flex-col justify-center border-b bg-white px-6">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
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
                  !pathname.match(/^\/admin\/[^/]+\/(goals|startups|invoices|leaderboard)/))
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
              item.href === '/admin/admins')
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
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          )
        })}
      </nav>

      {showCohortSelector && (
        <div className="border-t p-4 space-y-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Cohort</label>
            {!mounted || isLoadingCohorts ? (
              <div className="h-9 rounded-md border bg-muted animate-pulse" />
            ) : (
              <Select value={currentCohortSlug || ''} onValueChange={handleCohortChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select cohort">
                    {selectedCohort ? selectedCohort.label : 'Select cohort'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((cohort) => (
                    <SelectItem key={cohort._id} value={cohort.slug}>
                      {cohort.label} ({cohort.yearStart} - {cohort.yearEnd})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {userRole === 'super_admin' && (
            <Link href="/admin/cohorts/new" onClick={onLinkClick}>
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="mr-2 h-3 w-3" />
                Create New Cohort
              </Button>
            </Link>
          )}
        </div>
      )}

      <div className="border-t px-4 py-3">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">AccelerateMe Internal Tool</p>
          {mounted && (
            <div className="flex items-center justify-start">
              <UserButton />
            </div>
          )}
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
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed left-4 top-4 z-40 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-white">
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

      <aside className="hidden fixed left-0 top-0 z-30 h-screen w-64 flex-col border-r bg-white lg:flex">
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
