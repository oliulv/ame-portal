'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MetricChart } from '@/components/analytics/metric-chart'
import { ArrowLeft, RefreshCw, TrendingUp, Eye, Plug } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminStartupAnalyticsPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const slug = params.slug as string

  const [range, setRange] = useState('30')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const startup = useQuery(api.startups.getBySlug, { slug })
  const startupId = startup?._id

  const integrationStatus = useQuery(
    api.integrations.statusForAdmin,
    startupId ? { startupId } : 'skip'
  )

  const startDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - parseInt(range))
    return d.toISOString()
  }, [range])

  const timeSeriesArgs = startupId ? { window: 'daily' as const, startDate } : null

  // Stripe metrics
  const revenue = useQuery(
    api.metrics.timeSeries,
    timeSeriesArgs
      ? { startupId: startupId!, provider: 'stripe', metricKey: 'total_revenue', ...timeSeriesArgs }
      : 'skip'
  )
  const mrr = useQuery(
    api.metrics.timeSeries,
    timeSeriesArgs
      ? { startupId: startupId!, provider: 'stripe', metricKey: 'mrr', ...timeSeriesArgs }
      : 'skip'
  )
  const customers = useQuery(
    api.metrics.timeSeries,
    timeSeriesArgs
      ? {
          startupId: startupId!,
          provider: 'stripe',
          metricKey: 'active_customers',
          ...timeSeriesArgs,
        }
      : 'skip'
  )

  // Tracker metrics
  const sessions = useQuery(
    api.metrics.timeSeries,
    timeSeriesArgs
      ? { startupId: startupId!, provider: 'tracker', metricKey: 'sessions', ...timeSeriesArgs }
      : 'skip'
  )
  const pageviews = useQuery(
    api.metrics.timeSeries,
    timeSeriesArgs
      ? { startupId: startupId!, provider: 'tracker', metricKey: 'pageviews', ...timeSeriesArgs }
      : 'skip'
  )
  const activeUsers = useQuery(
    api.metrics.timeSeries,
    timeSeriesArgs
      ? {
          startupId: startupId!,
          provider: 'tracker',
          metricKey: 'weekly_active_users',
          ...timeSeriesArgs,
        }
      : 'skip'
  )

  const syncMetrics = useAction(api.metrics.syncMetricsForStartup)

  const handleRefresh = async () => {
    if (!startupId) return
    setIsRefreshing(true)
    try {
      await syncMetrics({ startupId })
      toast.success('Metrics synced successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sync metrics')
    } finally {
      setIsRefreshing(false)
    }
  }

  const isLoading = startup === undefined || integrationStatus === undefined

  const hasStripe = integrationStatus?.stripe !== null
  const hasTracker = integrationStatus?.tracker !== null

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
      <div className="space-y-4">
        <div>
          <Link href={`/admin/${cohortSlug}/startups/${slug}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Startup
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">Analytics</h1>
            <p className="text-muted-foreground">
              {startup?.name
                ? `${startup.name} performance metrics`
                : 'Startup performance metrics'}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Sync status */}
      {integrationStatus?.stripe && (
        <div className="text-xs text-muted-foreground">
          {integrationStatus.stripe.lastSyncedAt && (
            <span>
              Last synced: {new Date(integrationStatus.stripe.lastSyncedAt).toLocaleString()}
            </span>
          )}
          {integrationStatus.stripe.syncError && (
            <span className="text-destructive ml-4">
              Sync error: {integrationStatus.stripe.syncError}
            </span>
          )}
        </div>
      )}

      {/* No Data */}
      {!hasStripe && !hasTracker && (
        <EmptyState
          icon={<Plug className="h-6 w-6" />}
          title="No integrations connected"
          description="Metrics will appear here once the startup connects Stripe or adds the Accelerate ME Tracker."
        />
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
        </div>
      )}
    </div>
  )
}
