'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Building2, ExternalLink, Users, Target, Edit } from 'lucide-react'
import { Startup, Cohort, GoalTemplate } from '@/lib/types'

export default function StartupsPage() {
  const [startups, setStartups] = useState<Startup[]>([])
  const [cohort, setCohort] = useState<Cohort | null>(null)
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCohortSlug, setSelectedCohortSlug] = useState<string>('')

  useEffect(() => {
    const loadData = async () => {
      // Get selected cohort from localStorage (support both old id and new slug)
      const storedCohortSlug = localStorage.getItem('selectedCohortSlug')
      const storedCohortId = localStorage.getItem('selectedCohortId')
      
      if (!storedCohortSlug && !storedCohortId) {
        // If no cohort selected, get the first active cohort
        const cohortsResponse = await fetch('/api/admin/cohorts')
        if (cohortsResponse.ok) {
          const cohorts: Cohort[] = await cohortsResponse.json()
          const activeCohort = cohorts.find(c => c.is_active) || cohorts[0]
          if (activeCohort) {
            setSelectedCohortSlug(activeCohort.slug)
            localStorage.setItem('selectedCohortSlug', activeCohort.slug)
            loadStartups(activeCohort.slug)
          } else {
            setIsLoading(false)
          }
        }
      } else {
        const slugToUse = storedCohortSlug || (storedCohortId ? await migrateCohortIdToSlug(storedCohortId) : null)
        if (slugToUse) {
          setSelectedCohortSlug(slugToUse)
          loadStartups(slugToUse)
        }
      }
    }

    const migrateCohortIdToSlug = async (cohortId: string): Promise<string | null> => {
      const cohortsResponse = await fetch('/api/admin/cohorts')
      if (cohortsResponse.ok) {
        const cohorts: Cohort[] = await cohortsResponse.json()
        const cohort = cohorts.find(c => c.id === cohortId)
        if (cohort) {
          localStorage.setItem('selectedCohortSlug', cohort.slug)
          localStorage.removeItem('selectedCohortId')
          return cohort.slug
        }
      }
      return null
    }

    const loadStartups = async (cohortSlug: string) => {
      try {
        setIsLoading(true)
        
        // Fetch cohort details by slug first to get the id
        const cohortResponse = await fetch(`/api/admin/cohorts/${cohortSlug}`)
        if (!cohortResponse.ok) {
          throw new Error('Failed to load cohort')
        }
        
        const cohortData: Cohort = await cohortResponse.json()
        setCohort(cohortData)
        
        // Fetch startups and goal templates using the cohort id
        const [startupsResponse, goalsResponse] = await Promise.all([
          fetch(`/api/admin/startups?cohort_id=${cohortData.id}`),
          fetch(`/api/admin/goals?cohort_id=${cohortData.id}`),
        ])

        if (startupsResponse.ok) {
          const startupsData: Startup[] = await startupsResponse.json()
          setStartups(startupsData)
        }

        if (goalsResponse.ok) {
          const goalsData: GoalTemplate[] = await goalsResponse.json()
          setGoalTemplates(goalsData)
        }
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // Listen for cohort changes from sidebar
    const handleCohortChange = () => {
      const newCohortSlug = localStorage.getItem('selectedCohortSlug')
      if (newCohortSlug && newCohortSlug !== selectedCohortSlug) {
        setSelectedCohortSlug(newCohortSlug)
        loadStartups(newCohortSlug)
      }
    }

    loadData()
    
    // Listen for custom cohort change event (from sidebar)
    window.addEventListener('cohortChanged', handleCohortChange)
    
    // Also listen for storage changes (for cross-tab updates)
    window.addEventListener('storage', handleCohortChange)

    return () => {
      window.removeEventListener('cohortChanged', handleCohortChange)
      window.removeEventListener('storage', handleCohortChange)
    }
  }, [selectedCohortSlug])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Startups</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {cohort ? (
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{cohort.label}</h1>
              <Badge variant={cohort.is_active ? 'success' : 'secondary'}>
                {cohort.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          ) : (
            <h1 className="text-3xl font-bold tracking-tight">Startups</h1>
          )}
          <p className="text-muted-foreground">
            {cohort ? cohort.name : 'Manage startups in your accelerator program'}
          </p>
        </div>
        <div className="flex gap-2">
          {cohort && (
            <Link href={`/admin/cohorts/${cohort.slug}/edit`}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit Cohort
              </Button>
            </Link>
          )}
          <Link href="/admin/startups/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Startup
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      {cohort && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Program Years</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {cohort.year_start} - {cohort.year_end}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Startups</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{startups?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Goal Templates</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{goalTemplates?.length || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Startups Table */}
      <Card>
        <CardHeader>
          <CardTitle>Startups in this Cohort</CardTitle>
          <CardDescription>
            {cohort ? `All startups enrolled in ${cohort.label}` : 'All startups'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {startups && startups.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {startups.map((startup) => (
                  <TableRow key={startup.id}>
                    <TableCell className="font-medium">{startup.name}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {startup.sector || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {startup.stage || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {startup.onboarding_status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/startups/${startup.slug || startup.id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/startups/${startup.slug || startup.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {cohort ? 'No startups in this cohort yet' : 'No startups found'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Goal Templates Table */}
      {cohort && (
        <Card>
          <CardHeader>
            <CardTitle>Goal Templates</CardTitle>
            <CardDescription>
              Default goals assigned to new startups in this cohort
            </CardDescription>
          </CardHeader>
          <CardContent>
            {goalTemplates && goalTemplates.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Target Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goalTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {template.category}
                        </Badge>
                      </TableCell>
                      <TableCell>{template.default_target_value || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={template.is_active ? 'success' : 'secondary'}>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/goals/${template.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No goal templates configured for this cohort
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

