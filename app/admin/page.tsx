import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Building2, FileText, ArrowRight, Plus } from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Get basic counts
  const [cohortsResult, startupsResult, invoicesResult] = await Promise.all([
    supabase.from('cohorts').select('id', { count: 'exact', head: true }),
    supabase.from('startups').select('id', { count: 'exact', head: true }),
    supabase.from('invoices').select('id', { count: 'exact', head: true }),
  ])

  const cohortsCount = cohortsResult.count || 0
  const startupsCount = startupsResult.count || 0
  const invoicesCount = invoicesResult.count || 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your accelerator program
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Cohorts
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cohortsCount}</div>
            <p className="text-xs text-muted-foreground">
              Active and past cohorts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Startups
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{startupsCount}</div>
            <p className="text-xs text-muted-foreground">
              Across all cohorts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Invoices
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoicesCount}</div>
            <p className="text-xs text-muted-foreground">
              Submitted for review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and workflows
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Link href="/admin/startups/new">
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
          <Link href="/admin/goals/new">
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
          <Link href="/admin/goals">
            <Button variant="outline" className="w-full justify-between">
              Manage Goal Templates
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/admin/invoices">
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

