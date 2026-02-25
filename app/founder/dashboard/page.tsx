'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target, FileText, Building2, Plug } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'

export default function FounderDashboard() {
  const milestones = useQuery(api.milestones.listForFounder)
  const invoicesData = useQuery(api.invoices.listForFounder)
  const integrationStatus = useQuery(api.integrations.status)
  const trackerWebsites = useQuery(api.trackerWebsites.list)

  const isLoading = milestones === undefined || invoicesData === undefined

  const hasStripe = integrationStatus?.stripe?.status === 'active'
  const hasTracker = (trackerWebsites?.length ?? 0) > 0
  const hasAnyIntegration = hasStripe || hasTracker
  const integrationsLoaded = integrationStatus !== undefined && trackerWebsites !== undefined

  const potential = milestones?.reduce((sum, m) => sum + m.amount, 0) ?? 0
  const unlocked =
    milestones?.filter((m) => m.status === 'approved').reduce((sum, m) => sum + m.amount, 0) ?? 0
  const unlockedPct = potential > 0 ? Math.round((unlocked / potential) * 100) : 0
  const pendingInvoices = invoicesData?.pendingCount ?? 0
  const hasStartups = (milestones?.length ?? 0) > 0

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-4" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!hasStartups) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your founder portal</p>
        </div>
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No startup found"
          description="No startup is associated with your account. Please contact support for assistance."
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your startup progress</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funding</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {'\u00A3'}
              {unlocked.toLocaleString('en-GB')} / {'\u00A3'}
              {potential.toLocaleString('en-GB')}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-green-500 transition-all"
                  style={{ width: `${unlockedPct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{unlockedPct}%</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{unlockedPct}% unlocked</p>
            <Link href="/founder/funding" className="mt-3 inline-block">
              <Button variant="link" size="sm" className="h-auto p-0">
                View funding details →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInvoices}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {pendingInvoices === 0 ? 'All caught up!' : `${pendingInvoices} awaiting review`}
            </p>
            <Link href="/founder/invoices" className="mt-3 inline-block">
              <Button variant="link" size="sm" className="h-auto p-0">
                View invoices →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Integration setup prompt */}
      {integrationsLoaded && !hasAnyIntegration && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-muted p-3">
                <Plug className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Set up integrations</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect Stripe to track revenue automatically, or add the AccelerateMe Tracker to
                  monitor website traffic. Your analytics dashboard will populate once connected.
                </p>
                <div className="mt-3 flex gap-2">
                  <Link href="/founder/settings?tab=integrations">
                    <Button size="sm">Connect Integrations</Button>
                  </Link>
                  <Link href="/founder/analytics">
                    <Button variant="outline" size="sm">
                      View Analytics
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
