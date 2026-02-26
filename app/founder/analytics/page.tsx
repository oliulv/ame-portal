'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plug, TrendingUp, Eye } from 'lucide-react'
import Link from 'next/link'

export default function FounderAnalyticsPage() {
  const integrationStatus = useQuery(api.integrations.status)
  const trackerWebsites = useQuery(api.trackerWebsites.list)

  const isLoading = integrationStatus === undefined || trackerWebsites === undefined

  const hasStripe = integrationStatus?.stripe?.status === 'active'
  const hasTracker = (trackerWebsites?.length ?? 0) > 0
  const hasAnyIntegration = hasStripe || hasTracker

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Track your startup&apos;s performance metrics</p>
      </div>

      {/* No integrations prompt */}
      {!hasAnyIntegration && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Plug className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Integrations Connected</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Connect Stripe to track revenue and customers automatically, or add the Accelerate
                ME Tracker to monitor website traffic and user activity.
              </p>
              <Link href="/founder/settings?tab=integrations">
                <Button>Set Up Integrations</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stripe section */}
      {hasStripe && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Revenue Metrics
          </h2>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Stripe is connected. Revenue metrics will appear here once data is synced.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tracker section */}
      {hasTracker && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Eye className="h-6 w-6" />
            Traffic Metrics
          </h2>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Tracker is configured. Traffic metrics will appear here once events are recorded.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Individual integration prompts when partially set up */}
      {hasAnyIntegration && !hasStripe && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Want to track revenue?</p>
                <p className="text-sm text-muted-foreground">
                  Connect Stripe to automatically track revenue, MRR, and customer metrics.
                </p>
              </div>
              <Link href="/founder/settings?tab=integrations">
                <Button variant="outline" size="sm">
                  Connect Stripe
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {hasAnyIntegration && !hasTracker && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Want to track website traffic?</p>
                <p className="text-sm text-muted-foreground">
                  Add the Accelerate ME Tracker to monitor pageviews, sessions, and user activity.
                </p>
              </div>
              <Link href="/founder/settings?tab=integrations">
                <Button variant="outline" size="sm">
                  Set Up Tracker
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
