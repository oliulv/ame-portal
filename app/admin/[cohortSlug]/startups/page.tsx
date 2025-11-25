'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
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
import { Startup, GoalTemplate } from '@/lib/types'
import { useSelectedCohort } from '@/lib/hooks/useSelectedCohort'

export default function StartupsPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const { cohort } = useSelectedCohort()
  const [startups, setStartups] = useState<Startup[]>([])
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadStartups = async () => {
      if (!cohort) return

      try {
        setIsLoading(true)

        // Fetch startups and goal templates using the cohort id
        const [startupsResponse, goalsResponse] = await Promise.all([
          fetch(`/api/admin/startups?cohort_id=${cohort.id}`),
          fetch(`/api/admin/goals?cohort_id=${cohort.id}`),
        ])

        if (startupsResponse.ok) {
          const startupsData: Startup[] = await startupsResponse.json()
          setStartups(startupsData)
        }

        if (goalsResponse.ok) {
          const goalsData: GoalTemplate[] = await goalsResponse.json()
          // Filter out duplicate "Join AccelerateMe" goals - keep only the first one
          const seenAccelerateMe = new Set<string>()
          const filteredGoals = goalsData.filter((goal) => {
            const isAccelerateMe =
              goal.title === 'Join AccelerateMe' ||
              goal.title.toLowerCase().includes('join accelerateme')
            if (isAccelerateMe) {
              if (seenAccelerateMe.has(goal.cohort_id || '')) {
                return false // Skip duplicate
              }
              seenAccelerateMe.add(goal.cohort_id || '')
            }
            return true
          })
          setGoalTemplates(filteredGoals)
        }
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (cohort) {
      loadStartups()
    }
  }, [cohort])

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

  if (!cohort) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Startups</h1>
            <p className="text-muted-foreground">Cohort not found</p>
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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{cohort.label}</h1>
            <Badge variant={cohort.is_active ? 'success' : 'secondary'}>
              {cohort.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-muted-foreground">{cohort.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/cohorts/${cohort.slug}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit Cohort
            </Button>
          </Link>
          <Link href={`/admin/${cohortSlug}/startups/new`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Startup
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
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

      {/* Startups Table */}
      <Card>
        <CardHeader>
          <CardTitle>Startups in this Cohort</CardTitle>
          <CardDescription>All startups enrolled in {cohort.label}</CardDescription>
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
                      <span className="text-sm text-muted-foreground">{startup.sector || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{startup.stage || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {startup.onboarding_status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/${cohortSlug}/startups/${startup.slug || startup.id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link
                          href={`/admin/${cohortSlug}/startups/${startup.slug || startup.id}/edit`}
                        >
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
            <EmptyState
              noCard
              icon={<Building2 className="h-6 w-6" />}
              title="No startups enrolled"
              description="There are no startups enrolled in this cohort yet. Create a startup to start tracking their progress."
              action={
                <Link href={`/admin/${cohortSlug}/startups/new`}>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Startup
                  </Button>
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Goal Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Goal Templates</CardTitle>
          <CardDescription>Default goals assigned to new startups in this cohort</CardDescription>
        </CardHeader>
        <CardContent>
          {goalTemplates && goalTemplates.length > 0 ? (
            <>
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
                        <Link href={`/admin/${cohortSlug}/goals/${template.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {goalTemplates.length === 1 && goalTemplates[0].title === 'Join AccelerateMe' && (
                <div className="mt-4 flex justify-center">
                  <Link href={`/admin/${cohortSlug}/goals/new`}>
                    <Button variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Create More Goal Templates
                    </Button>
                  </Link>
                </div>
              )}
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No goal templates configured for this cohort
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
