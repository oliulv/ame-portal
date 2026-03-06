'use client'

import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MetricChart } from '@/components/analytics/metric-chart'
import { Plug, TrendingUp, Eye, Clock } from 'lucide-react'
import Link from 'next/link'

export default function FounderAnalyticsPage() {
  const [range, setRange] = useState('30')

  const integrationStatus = useQuery(api.integrations.status)
  const trackerWebsites = useQuery(api.trackerWebsites.list)
  const startupId = useQuery(api.integrations.getFounderStartupId)

  const isLoading =
    integrationStatus === undefined || trackerWebsites === undefined || startupId === undefined

  const hasStripe = integrationStatus?.stripe?.status === 'active'
  const hasTracker = (trackerWebsites?.length ?? 0) > 0
  const trackerHasEvents = trackerWebsites?.some((w) => w.lastEventAt) ?? false
  const hasAnyIntegration = hasStripe || hasTracker

  const startDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - parseInt(range))
    return d.toISOString()
  }, [range])

  const baseArgs = startupId ? { startupId, window: 'daily' as const, startDate } : null

  // Stripe metrics
  const revenue = useQuery(
    api.metrics.timeSeries,
    baseArgs ? { ...baseArgs, provider: 'stripe' as const, metricKey: 'total_revenue' } : 'skip'
  )
  const mrr = useQuery(
    api.metrics.timeSeries,
    baseArgs ? { ...baseArgs, provider: 'stripe' as const, metricKey: 'mrr' } : 'skip'
  )
  const customers = useQuery(
    api.metrics.timeSeries,
    baseArgs ? { ...baseArgs, provider: 'stripe' as const, metricKey: 'active_customers' } : 'skip'
  )

  // Tracker metrics
  const sessions = useQuery(
    api.metrics.timeSeries,
    baseArgs ? { ...baseArgs, provider: 'tracker' as const, metricKey: 'sessions' } : 'skip'
  )
  const pageviews = useQuery(
    api.metrics.timeSeries,
    baseArgs ? { ...baseArgs, provider: 'tracker' as const, metricKey: 'pageviews' } : 'skip'
  )
  const activeUsers = useQuery(
    api.metrics.timeSeries,
    baseArgs
      ? { ...baseArgs, provider: 'tracker' as const, metricKey: 'weekly_active_users' }
      : 'skip'
  )

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Analytics</h1>
          <p className="text-muted-foreground">Track your startup&apos;s performance metrics</p>
        </div>
        {hasAnyIntegration && (
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Sync status */}
      {integrationStatus?.stripe && (
        <div className="text-xs text-muted-foreground">
          {integrationStatus.stripe.lastSyncedAt && (
            <span>
              Last synced: {new Date(integrationStatus.stripe.lastSyncedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

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
              <Link href="/founder/integrations">
                <Button>Set Up Integrations</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stripe Metrics */}
      {hasStripe && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Revenue Metrics
            {integrationStatus?.stripe?.accountName && (
              <span className="text-sm font-normal text-muted-foreground">
                ({integrationStatus.stripe.accountName})
              </span>
            )}
          </h2>

          <MetricChart
            title="Total Revenue"
            description="All-time revenue (net of refunds)"
            data={revenue ?? []}
            formatValue={(v) =>
              `£${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            }
          />

          <MetricChart
            title="Monthly Recurring Revenue (MRR)"
            description="Recurring revenue from subscriptions"
            data={mrr ?? []}
            formatValue={(v) =>
              `£${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            }
          />

          <MetricChart
            title="Active Customers"
            description="Number of active paying customers"
            data={customers ?? []}
            formatValue={(v) => v.toLocaleString()}
          />
        </div>
      )}

      {/* Tracker Metrics */}
      {hasTracker && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            Traffic Metrics
          </h2>

          {trackerHasEvents ? (
            <>
              <MetricChart
                title="Sessions"
                description="Total number of user sessions"
                data={sessions ?? []}
                formatValue={(v) => v.toLocaleString()}
              />

              <MetricChart
                title="Page Views"
                description="Total number of page views"
                data={pageviews ?? []}
                formatValue={(v) => v.toLocaleString()}
              />

              <MetricChart
                title="Active Users"
                description="Number of unique active users"
                data={activeUsers ?? []}
                formatValue={(v) => v.toLocaleString()}
              />
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Waiting for first event</p>
                    <p className="text-sm text-muted-foreground">
                      Your tracker is set up but hasn&apos;t received any events yet. Make sure
                      you&apos;ve added the script to your website.{' '}
                      <Link
                        href="/founder/integrations?tab=tracker"
                        className="underline font-medium text-primary hover:text-primary/80"
                      >
                        View setup
                      </Link>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
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
              <Link href="/founder/integrations?tab=stripe">
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
              <Link href="/founder/integrations?tab=tracker">
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
