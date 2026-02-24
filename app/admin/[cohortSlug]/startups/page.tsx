'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
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

export default function StartupsPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const startups = useQuery(
    api.startups.list,
    cohort ? { cohortId: cohort._id } : 'skip'
  )
  const goalTemplates = useQuery(
    api.goalTemplates.list,
    cohort ? { cohortId: cohort._id } : 'skip'
  )

  const isLoading = cohort === undefined || (cohort && (startups === undefined || goalTemplates === undefined))

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
            <Badge variant={cohort.isActive ? 'success' : 'secondary'}>
              {cohort.isActive ? 'Active' : 'Inactive'}
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
              {cohort.yearStart} - {cohort.yearEnd}
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
                  <TableRow key={startup._id}>
                    <TableCell className="font-medium">{startup.name}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{startup.sector || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{startup.stage || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {startup.onboardingStatus.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/${cohortSlug}/startups/${startup.slug || startup._id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link
                          href={`/admin/${cohortSlug}/startups/${startup.slug || startup._id}/edit`}
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
                    <TableRow key={template._id}>
                      <TableCell className="font-medium">{template.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {template.category}
                        </Badge>
                      </TableCell>
                      <TableCell>{template.defaultTargetValue || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={template.isActive ? 'success' : 'secondary'}>
                          {template.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/${cohortSlug}/goals/${template._id}/edit`}>
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
