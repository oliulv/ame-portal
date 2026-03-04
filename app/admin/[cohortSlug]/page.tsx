'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Building2, FileText, ArrowRight, Plus, Target } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

export default function AdminDashboard() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const stats = useQuery(api.startups.dashboardStats, { cohortSlug })

  const isLoading = cohort === undefined || stats === undefined

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const cohortsCount = stats?.cohortsCount || 0
  const startupsCount = stats?.startupsCount || 0
  const invoicesCount = stats?.invoicesCount || 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Dashboard</h1>
        <p className="text-muted-foreground">
          {cohort ? `Overview for ${cohort.label}` : 'Overview of your accelerator program'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Startups</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="text-2xl font-bold font-display">{startupsCount}</div>
            <p className="text-xs text-muted-foreground">Startups in this cohort</p>
            <Link href={`/admin/${cohortSlug}/startups`} className="mt-auto pt-3 inline-block">
              <Button variant="link" size="sm" className="h-auto p-0">
                View startups →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="text-2xl font-bold font-display">{invoicesCount}</div>
            <p className="text-xs text-muted-foreground">Invoices from this cohort</p>
            <Link href={`/admin/${cohortSlug}/invoices`} className="mt-auto pt-3 inline-block">
              <Button variant="link" size="sm" className="h-auto p-0">
                View invoices →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cohorts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="text-2xl font-bold font-display">{cohortsCount}</div>
            <p className="text-xs text-muted-foreground">All cohorts in system</p>
            <Link href="/admin/cohorts" className="mt-auto pt-3 inline-block">
              <Button variant="link" size="sm" className="h-auto p-0">
                View cohorts →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

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
          <Link href={`/admin/${cohortSlug}/funding`}>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center">
                <Target className="mr-2 h-4 w-4" />
                Manage Funding
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
          <Link href={`/admin/${cohortSlug}/funding/templates`}>
            <Button variant="outline" className="w-full justify-between">
              Milestone Templates
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
