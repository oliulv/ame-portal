'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { cohortsApi } from '@/lib/api/cohorts'
import { queryKeys } from '@/lib/queryKeys'
import { Cohort } from '@/lib/types'

/**
 * Extract cohort slug from URL path
 * Expected format: /admin/[cohortSlug]/...
 */
function extractCohortSlugFromPath(pathname: string): string | null {
  // Match /admin/[cohortSlug]/... pattern
  const match = pathname.match(/^\/admin\/([^/]+)(?:\/|$)/)
  if (match && match[1]) {
    const slug = match[1]
    // Exclude known non-cohort routes
    const excludedRoutes = ['cohorts', 'startups', 'goals', 'invoices', 'leaderboard', 'new']
    if (!excludedRoutes.includes(slug)) {
      return slug
    }
  }
  return null
}

/**
 * Hook to get the currently selected cohort from URL (primary) or localStorage (fallback)
 * Returns the cohort slug, id, and full cohort object
 *
 * This hook ensures that the cohort context is maintained sitewide
 * and automatically updates when the cohort selection changes.
 * URL is the primary source of truth, localStorage is used as fallback for legacy routes.
 */
export function useSelectedCohort() {
  const pathname = usePathname()
  const [selectedCohortSlug, setSelectedCohortSlug] = useState<string | null>(null)

  // Fetch all cohorts to get the selected cohort details
  const { data: cohorts = [], isLoading: isLoadingCohorts } = useQuery({
    queryKey: queryKeys.cohorts.lists(),
    queryFn: () => cohortsApi.getAll(),
    staleTime: 1000 * 60 * 10, // 10 minutes
  })

  // Initialize and listen for cohort changes
  useEffect(() => {
    // Primary: Try to get cohort slug from URL
    const urlCohortSlug = extractCohortSlugFromPath(pathname)

    if (urlCohortSlug) {
      // URL has cohort slug - use it and sync to localStorage
      setSelectedCohortSlug(urlCohortSlug)
      localStorage.setItem('selectedCohortSlug', urlCohortSlug)
    } else {
      // Fallback: Get cohort from localStorage (for legacy routes during transition)
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
        } else if (cohorts.length > 0) {
          const activeCohort = cohorts.find((c: Cohort) => c.is_active) || cohorts[0]
          if (activeCohort) {
            setSelectedCohortSlug(activeCohort.slug)
            localStorage.setItem('selectedCohortSlug', activeCohort.slug)
          }
        }
      } else if (cohorts.length > 0) {
        // Default to first active cohort if none selected
        const activeCohort = cohorts.find((c: Cohort) => c.is_active) || cohorts[0]
        if (activeCohort) {
          setSelectedCohortSlug(activeCohort.slug)
          localStorage.setItem('selectedCohortSlug', activeCohort.slug)
        }
      }
    }

    // Listen for cohort change events (for legacy compatibility)
    const handleCohortChange = () => {
      // Only update if URL doesn't have a cohort slug (legacy route)
      const urlCohortSlug = extractCohortSlugFromPath(pathname)
      if (!urlCohortSlug) {
        const newCohortSlug = localStorage.getItem('selectedCohortSlug')
        setSelectedCohortSlug(newCohortSlug)
      }
    }

    // Listen for custom event from sidebar
    window.addEventListener('cohortChanged', handleCohortChange)

    // Also listen for storage changes (cross-tab updates)
    window.addEventListener('storage', handleCohortChange)

    return () => {
      window.removeEventListener('cohortChanged', handleCohortChange)
      window.removeEventListener('storage', handleCohortChange)
    }
  }, [pathname, cohorts])

  // Find the selected cohort object
  const selectedCohort = cohorts.find((c: Cohort) => c.slug === selectedCohortSlug) || null

  return {
    cohortSlug: selectedCohortSlug,
    cohortId: selectedCohort?.id || null,
    cohort: selectedCohort,
    isLoading: isLoadingCohorts,
  }
}
