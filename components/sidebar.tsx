'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
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
  Calendar,
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

interface NavItem {
  title: string
  href: string
  icon: string
  mobileOnly?: boolean
}

interface SidebarProps {
  title: string
  subtitle?: string
  navItems: NavItem[]
  showCohortSelector?: boolean
  userRole?: 'super_admin' | 'admin' | 'founder'
}

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Target,
  FileText,
  Trophy,
  Building2,
  Settings,
  TrendingUp,
  Gift,
  Calendar,
}

/**
 * Extract a cohort slug from an admin URL path.
 * Validates against known cohort slugs when available;
 * only 'cohorts' and 'settings' are hardcoded as global routes.
 */
function extractCohortSlugFromPath(pathname: string, knownSlugs?: string[]): string | null {
  const match = pathname.match(/^\/admin\/([^/]+)(?:\/|$)/)
  if (!match || !match[1]) return null
  const segment = match[1]
  if (segment === 'cohorts' || segment === 'settings') return null
  if (knownSlugs && knownSlugs.length > 0) {
    return knownSlugs.includes(segment) ? segment : null
  }
  return segment
}

/**
 * Rewrite a base nav href to include the cohort slug.
 * Non-admin routes pass through unchanged.
 * Global admin routes (/admin/cohorts, /admin/settings) are never rewritten.
 * Everything else: /admin/X → /admin/{slug}/X
 */
function buildNavHref(baseHref: string, cohortSlug: string | null): string {
  if (!baseHref.startsWith('/admin')) return baseHref
  if (baseHref === '/admin/cohorts' || baseHref === '/admin/settings') return baseHref
  if (!cohortSlug) return '#'
  if (baseHref === '/admin') return `/admin/${cohortSlug}`
  return baseHref.replace(/^\/admin/, `/admin/${cohortSlug}`)
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
  const cohorts = useMemo(() => cohortsData ?? [], [cohortsData])
  const cohortSlugs = useMemo(() => cohorts.map((c) => c.slug), [cohorts])
  const isLoadingCohorts = cohortsData === undefined && showCohortSelector

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!showCohortSelector || cohorts.length === 0) return

    const urlCohortSlug = extractCohortSlugFromPath(pathname, cohortSlugs)

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

      const isGlobalRoute =
        pathname.startsWith('/admin/settings') || pathname.startsWith('/admin/cohorts')

      if (!urlCohortSlug && pathname.startsWith('/admin') && !isGlobalRoute) {
        if (pathname === '/admin' || pathname === '/admin/') {
          router.replace(`/admin/${resolvedSlug}`)
        } else {
          const subPath = pathname.replace(/^\/admin/, '')
          router.replace(`/admin/${resolvedSlug}${subPath}`)
        }
      }
    }
  }, [showCohortSelector, cohorts, cohortSlugs, pathname, mounted, router])

  const handleCohortChange = (newCohortSlug: string) => {
    setSelectedCohortSlug(newCohortSlug)
    localStorage.setItem('selectedCohortSlug', newCohortSlug)

    const urlCohortSlug = extractCohortSlugFromPath(pathname, cohortSlugs)
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
  const urlCohortSlug = extractCohortSlugFromPath(pathname, cohortSlugs)
  const currentCohortSlug =
    urlCohortSlug || (selectedCohortSlug && selectedCohortSlug !== '' ? selectedCohortSlug : null)

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
        ? pathname === href
        : pathname === href || pathname.startsWith(href + '/')
    const Icon = iconMap[item.icon] || LayoutDashboard

    const isAdminRoute = item.href.startsWith('/admin')
    const isGlobalAdmin = item.href === '/admin/cohorts' || item.href === '/admin/settings'
    const needsCohortSlug =
      showCohortSelector && isAdminRoute && !isGlobalAdmin && !cohortSlugForHref
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
          'flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-sidebar-active text-sidebar-active-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-active-foreground',
          isDisabled && 'pointer-events-none opacity-40',
          item.mobileOnly && 'lg:hidden'
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {item.title}
      </Link>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Brand */}
      <div className="flex items-center h-12 px-4 border-b border-sidebar-border">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-sidebar-active-foreground">
            {title}
          </h1>
          {subtitle && <p className="text-[10px] leading-tight text-sidebar-muted">{subtitle}</p>}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 pt-3">{navItems.map(renderNavItem)}</nav>

      {/* Bottom section */}
      <div className="mt-auto">
        {/* Cohort selector (admin only) */}
        {showCohortSelector && (
          <div className="px-3 pb-3">
            <Link
              href="/admin/cohorts"
              onClick={onLinkClick}
              className="mb-1.5 block px-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted hover:text-sidebar-active-foreground transition-colors"
            >
              Cohorts
            </Link>
            {!mounted || isLoadingCohorts ? (
              <div className="h-9 bg-sidebar-active animate-pulse" />
            ) : (
              <Select value={currentCohortSlug || ''} onValueChange={handleCohortChange}>
                <SelectTrigger
                  data-sidebar-select
                  className="w-full text-sm h-9"
                  style={{
                    borderColor: 'hsl(152, 20%, 22%)',
                    backgroundColor: 'hsl(152, 35%, 13%)',
                    color: 'hsl(140, 20%, 95%)',
                    outline: 'none',
                    boxShadow: 'none',
                  }}
                >
                  <SelectValue placeholder="Select cohort">
                    {selectedCohort ? selectedCohort.label : 'Select cohort'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  data-sidebar-select
                  style={{
                    backgroundColor: 'hsl(152, 30%, 11%)',
                    borderColor: 'hsl(152, 20%, 22%)',
                  }}
                >
                  {cohorts.map((cohort) => (
                    <SelectItem key={cohort._id} value={cohort.slug} data-sidebar-select-item>
                      {cohort.label} ({cohort.yearStart} - {cohort.yearEnd})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {userRole === 'super_admin' && (
              <Link href="/admin/cohorts/new" onClick={onLinkClick} className="mt-2 block">
                <button className="flex w-full items-center justify-center gap-2 border border-sidebar-border px-3 py-1.5 text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-hover hover:text-sidebar-active-foreground">
                  <Plus className="h-3.5 w-3.5" />
                  New Cohort
                </button>
              </Link>
            )}
          </div>
        )}
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
          <SheetContent side="left" className="w-56 p-0 bg-sidebar border-sidebar-border">
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
      <aside className="fixed left-0 top-0 z-30 hidden h-[100dvh] w-56 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex">
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
