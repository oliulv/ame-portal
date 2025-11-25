'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { Cohort } from '@/lib/types'
import { UserButton } from '@clerk/nextjs'
import { queryKeys } from '@/lib/queryKeys'
import { cohortsApi } from '@/lib/api/cohorts'

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

/**
 * Extract cohort slug from URL path
 */
function extractCohortSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/([^/]+)(?:\/|$)/)
  if (match && match[1]) {
    const slug = match[1]
    const excludedRoutes = ['cohorts', 'startups', 'goals', 'invoices', 'leaderboard', 'new']
    if (!excludedRoutes.includes(slug)) {
      return slug
    }
  }
  return null
}

/**
 * Build navigation href with cohort slug
 */
function buildNavHref(baseHref: string, cohortSlug: string | null): string {
  if (!cohortSlug) return baseHref

  // Map old routes to new cohort-scoped routes
  const routeMap: Record<string, string> = {
    '/admin': `/admin/${cohortSlug}`,
    '/admin/goals': `/admin/${cohortSlug}/goals`,
    '/admin/startups': `/admin/${cohortSlug}/startups`,
    '/admin/invoices': `/admin/${cohortSlug}/invoices`,
    '/admin/leaderboard': `/admin/${cohortSlug}/leaderboard`,
  }

  return routeMap[baseHref] || baseHref
}

function SidebarContent({
  title,
  subtitle,
  navItems,
  showCohortSelector = false,
  onLinkClick,
}: SidebarProps & { onLinkClick?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  // Initialize to empty string to avoid hydration mismatch
  // useEffect will update from localStorage after mount
  const [selectedCohortSlug, setSelectedCohortSlug] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  // Fetch cohorts using TanStack Query (only if showCohortSelector is true)
  // Use longer stale time since cohorts change infrequently, and realtime will update us
  const { data: cohorts = [], isLoading: isLoadingCohorts } = useQuery({
    queryKey: queryKeys.cohorts.lists(),
    queryFn: () => cohortsApi.getAll(),
    enabled: showCohortSelector,
    staleTime: 1000 * 60 * 10, // 10 minutes - cohorts don't change often, realtime handles updates
  })

  // Mark as mounted to prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize selected cohort from URL (primary) or localStorage (fallback)
  useEffect(() => {
    if (!showCohortSelector || cohorts.length === 0) return

    // Primary: Try to get cohort slug from URL
    const urlCohortSlug = extractCohortSlugFromPath(pathname)

    if (urlCohortSlug && cohorts.find((c: Cohort) => c.slug === urlCohortSlug)) {
      setSelectedCohortSlug(urlCohortSlug)
      if (mounted) {
        localStorage.setItem('selectedCohortSlug', urlCohortSlug)
      }
      return
    }

    // Fallback: Load selected cohort from localStorage or default to first active cohort
    if (!mounted) {
      // Before mount, don't read localStorage to avoid hydration mismatch
      // But still set a default cohort from available cohorts to prevent redirects
      const activeCohort = cohorts.find((c: Cohort) => c.is_active) || cohorts[0]
      if (activeCohort) {
        setSelectedCohortSlug(activeCohort.slug)
      }
      return
    }

    // After mount, read from localStorage
    const storedCohortSlug = localStorage.getItem('selectedCohortSlug')
    const storedCohortId = localStorage.getItem('selectedCohortId')

    if (storedCohortSlug && cohorts.find((c: Cohort) => c.slug === storedCohortSlug)) {
      setSelectedCohortSlug(storedCohortSlug)
    } else if (storedCohortId) {
      // Migrate from id to slug
      const cohort = cohorts.find((c: Cohort) => c.id === storedCohortId)
      if (cohort) {
        setSelectedCohortSlug(cohort.slug)
        localStorage.setItem('selectedCohortSlug', cohort.slug)
        localStorage.removeItem('selectedCohortId')
      } else {
        // Fallback to default cohort
        const activeCohort = cohorts.find((c: Cohort) => c.is_active) || cohorts[0]
        if (activeCohort) {
          setSelectedCohortSlug(activeCohort.slug)
          localStorage.setItem('selectedCohortSlug', activeCohort.slug)
          localStorage.removeItem('selectedCohortId')
        }
      }
    } else {
      // No stored cohort, use default
      const activeCohort = cohorts.find((c: Cohort) => c.is_active) || cohorts[0]
      if (activeCohort) {
        setSelectedCohortSlug(activeCohort.slug)
        localStorage.setItem('selectedCohortSlug', activeCohort.slug)
      }
    }
  }, [showCohortSelector, cohorts, pathname, mounted])

  const handleCohortChange = (newCohortSlug: string) => {
    setSelectedCohortSlug(newCohortSlug)
    localStorage.setItem('selectedCohortSlug', newCohortSlug)

    // Update URL by replacing cohort slug in current path
    const urlCohortSlug = extractCohortSlugFromPath(pathname)
    let newPath = pathname

    if (urlCohortSlug) {
      // Replace cohort slug in current path
      newPath = pathname.replace(`/admin/${urlCohortSlug}`, `/admin/${newCohortSlug}`)
    } else {
      // No cohort in URL, navigate to dashboard with new cohort
      newPath = `/admin/${newCohortSlug}`
    }

    router.push(newPath)

    // Trigger a custom event to notify other components (for legacy compatibility)
    window.dispatchEvent(new Event('cohortChanged'))
  }

  const selectedCohort = cohorts.find((c) => c.slug === selectedCohortSlug)
  const currentCohortSlug = extractCohortSlugFromPath(pathname) || selectedCohortSlug

  return (
    <div className="flex h-full flex-col">
      {/* Logo/Brand */}
      <div className="flex h-16 flex-col justify-center border-b bg-white px-6">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          // Build href with cohort slug if available
          // Priority: URL cohort > state cohort > first available cohort
          // Use first available cohort even before mount if cohorts are loaded (from query cache)
          // This ensures we always have a cohort slug when cohorts exist, preventing redirects
          let cohortSlugForHref: string | null = null
          if (currentCohortSlug) {
            // Always use URL-based cohort slug if available (consistent on server and client)
            cohortSlugForHref = currentCohortSlug
          } else if (selectedCohortSlug) {
            // Use state-based cohort slug (updated from localStorage or URL)
            cohortSlugForHref = selectedCohortSlug
          } else if (cohorts.length > 0) {
            // Fallback to first available cohort (prevents redirect to /admin/cohorts)
            // This is safe because cohorts query result is the same on server and client
            cohortSlugForHref =
              (cohorts.find((c: Cohort) => c.is_active) || cohorts[0])?.slug || null
          }
          const href = buildNavHref(item.href, cohortSlugForHref)

          // For root paths like /admin, match if pathname matches the cohort-scoped version
          // For other paths, match if pathname starts with the href
          const isActive =
            item.href === '/admin'
              ? pathname === href ||
                (pathname.startsWith(`/admin/${currentCohortSlug}/`) &&
                  !pathname.match(/^\/admin\/[^/]+\/(goals|startups|invoices|leaderboard)/))
              : pathname === href || pathname.startsWith(href + '/')
          const Icon = iconMap[item.icon] || LayoutDashboard

          // If we need a cohort slug but don't have one yet (and cohorts are loading), prevent navigation
          // This prevents clicking links that would redirect to /admin/cohorts
          const needsCohortSlug =
            showCohortSelector &&
            !cohortSlugForHref &&
            (item.href === '/admin/invoices' ||
              item.href === '/admin/leaderboard' ||
              item.href === '/admin/goals' ||
              item.href === '/admin/startups')
          const isDisabled = needsCohortSlug && isLoadingCohorts

          return (
            <Link
              key={item.href}
              href={isDisabled ? '#' : href}
              onClick={(e) => {
                if (isDisabled) {
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

      {/* Cohort Selector - Only for admins */}
      {showCohortSelector && (
        <div className="border-t p-4 space-y-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Cohort</label>
            {isLoadingCohorts ? (
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
                    <SelectItem key={cohort.id} value={cohort.slug}>
                      {cohort.label} ({cohort.year_start} - {cohort.year_end})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Link href="/admin/cohorts/new" onClick={onLinkClick}>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="mr-2 h-3 w-3" />
              Create New Cohort
            </Button>
          </Link>
        </div>
      )}

      {/* Footer with UserButton */}
      <div className="border-t px-4 py-3">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">AccelerateMe Internal Tool</p>
          <div className="flex items-center justify-start">
            <UserButton />
          </div>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ title, subtitle, navItems, showCohortSelector = false }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering Sheet on client
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      {/* Mobile Menu Button */}
      {mounted && (
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
                onLinkClick={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden fixed left-0 top-0 z-30 h-screen w-64 flex-col border-r bg-white lg:flex">
        <SidebarContent
          title={title}
          subtitle={subtitle}
          navItems={navItems}
          showCohortSelector={showCohortSelector}
        />
      </aside>
    </>
  )
}
