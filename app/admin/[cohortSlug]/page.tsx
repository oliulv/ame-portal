'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Building2, FileText, ArrowRight, Plus } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { dashboardApi } from '@/lib/api/dashboard'
import { useSelectedCohort } from '@/lib/hooks/useSelectedCohort'
import { EmptyState } from '@/components/ui/empty-state'

export default function AdminDashboard() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const { cohort } = useSelectedCohort()

  // Fetch dashboard stats using TanStack Query
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats', cohortSlug],
    queryFn: () => dashboardApi.getStats(cohortSlug),
    staleTime: 1000 * 30, // 30 seconds
  })

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const cohortsCount = stats?.cohortsCount || 0
  const startupsCount = stats?.startupsCount || 0
  const invoicesCount = stats?.invoicesCount || 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {cohort ? `Overview for ${cohort.label}` : 'Overview of your accelerator program'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Startups</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{startupsCount}</div>
            <p className="text-xs text-muted-foreground">Startups in this cohort</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoicesCount}</div>
            <p className="text-xs text-muted-foreground">Invoices from this cohort</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cohorts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cohortsCount}</div>
            <p className="text-xs text-muted-foreground">All cohorts in system</p>
          </CardContent>
        </Card>
      </div>

      {/* Call to Action - Show when no startups */}
      {startupsCount === 0 && (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No startups enrolled"
          description="Get started by creating your first startup in this cohort. Once enrolled, you'll be able to track their progress, goals, and invoices."
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

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and workflows</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Link href={`/admin/${cohortSlug}/startups/new`}>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Create Startup
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/admin/cohorts/new">
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Create Cohort
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/admin/${cohortSlug}/goals/new`}>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Create Goal Template
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/admin/cohorts">
            <Button variant="outline" className="w-full justify-between">
              Manage Cohorts
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/admin/${cohortSlug}/goals`}>
            <Button variant="outline" className="w-full justify-between">
              Manage Goal Templates
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/admin/${cohortSlug}/invoices`}>
            <Button variant="outline" className="w-full justify-between">
              Review Invoices
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
