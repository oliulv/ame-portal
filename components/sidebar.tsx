'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Cohort } from '@/lib/types'
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
}

const iconMap: Record<string, LucideIcon> = {
  'LayoutDashboard': LayoutDashboard,
  'Users': Users,
  'Target': Target,
  'FileText': FileText,
  'Trophy': Trophy,
  'Building2': Building2,
}

function SidebarContent({ title, subtitle, navItems, showCohortSelector = false, onLinkClick }: SidebarProps & { onLinkClick?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [selectedCohortSlug, setSelectedCohortSlug] = useState<string>('')
  const [isLoadingCohorts, setIsLoadingCohorts] = useState(true)

  // Load cohorts and selected cohort from localStorage (only if showCohortSelector is true)
  useEffect(() => {
    if (!showCohortSelector) {
      setIsLoadingCohorts(false)
      return
    }

    const loadCohorts = async () => {
      try {
        const response = await fetch('/api/admin/cohorts')
        if (response.ok) {
          const data = await response.json()
          setCohorts(data)
          
          // Load selected cohort from localStorage or default to first active cohort
          // Support both old id-based storage and new slug-based storage for migration
          const storedCohortSlug = localStorage.getItem('selectedCohortSlug')
          const storedCohortId = localStorage.getItem('selectedCohortId')
          
          if (storedCohortSlug && data.find((c: Cohort) => c.slug === storedCohortSlug)) {
            setSelectedCohortSlug(storedCohortSlug)
          } else if (storedCohortId) {
            // Migrate from id to slug
            const cohort = data.find((c: Cohort) => c.id === storedCohortId)
            if (cohort) {
              setSelectedCohortSlug(cohort.slug)
              localStorage.setItem('selectedCohortSlug', cohort.slug)
              localStorage.removeItem('selectedCohortId')
            } else {
              const activeCohort = data.find((c: Cohort) => c.is_active) || data[0]
              if (activeCohort) {
                setSelectedCohortSlug(activeCohort.slug)
                localStorage.setItem('selectedCohortSlug', activeCohort.slug)
                localStorage.removeItem('selectedCohortId')
              }
            }
          } else {
            const activeCohort = data.find((c: Cohort) => c.is_active) || data[0]
            if (activeCohort) {
              setSelectedCohortSlug(activeCohort.slug)
              localStorage.setItem('selectedCohortSlug', activeCohort.slug)
            }
          }
        }
      } catch (error) {
        console.error('Failed to load cohorts:', error)
      } finally {
        setIsLoadingCohorts(false)
      }
    }

    loadCohorts()
  }, [showCohortSelector])

  const handleCohortChange = (cohortSlug: string) => {
    setSelectedCohortSlug(cohortSlug)
    localStorage.setItem('selectedCohortSlug', cohortSlug)
    // Trigger a custom event to notify other components
    window.dispatchEvent(new Event('cohortChanged'))
    // Refresh the page if we're on a cohort-dependent page
    if (pathname.startsWith('/admin/startups')) {
      router.refresh()
    }
  }

  const selectedCohort = cohorts.find(c => c.slug === selectedCohortSlug)

  return (
    <div className="flex h-full flex-col">
      {/* Logo/Brand */}
      <div className="flex h-16 flex-col justify-center border-b bg-card px-6">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          // For root paths like /admin, only match exactly
          // For other paths, match if pathname starts with the href + '/'
          const isActive = item.href === '/admin'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = iconMap[item.icon] || LayoutDashboard

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
            <label className="text-xs font-medium text-muted-foreground">
              Cohort
            </label>
            {isLoadingCohorts ? (
              <div className="h-9 rounded-md border bg-muted animate-pulse" />
            ) : (
              <Select value={selectedCohortSlug} onValueChange={handleCohortChange}>
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
          <p className="text-xs text-muted-foreground">
            AccelerateMe Internal Tool
          </p>
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

  return (
    <>
      {/* Mobile Menu Button */}
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
          <SheetContent side="left" className="w-64 p-0">
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

      {/* Desktop Sidebar */}
      <aside className="hidden fixed left-0 top-0 z-30 h-screen w-64 flex-col border-r bg-card lg:flex">
        <SidebarContent title={title} subtitle={subtitle} navItems={navItems} showCohortSelector={showCohortSelector} />
      </aside>
    </>
  )
}
