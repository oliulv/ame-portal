// TODO: Migrate to Convex — currently uses broken /api/admin/startups/.../analytics endpoint
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricChart } from '@/components/analytics/metric-chart'
import { ArrowLeft, RefreshCw, TrendingUp, Eye } from 'lucide-react'

interface AnalyticsData {
  stripe: {
    revenue?: Array<{ timestamp: string; value: number }>
    customers?: Array<{ timestamp: string; value: number }>
    mrr?: Array<{ timestamp: string; value: number }>
  } | null
  tracker: {
    sessions?: Array<{ timestamp: string; value: number }>
    users?: Array<{ timestamp: string; value: number }>
    pageviews?: Array<{ timestamp: string; value: number }>
  } | null
}

export default function AdminStartupAnalyticsPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const slug = params.slug as string

  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [range, setRange] = useState('30')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/startups/${slug}/analytics?range=${range}`)
      if (response.ok) {
        const analyticsData = await response.json()
        setData(analyticsData)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [range, slug])

  useEffect(() => {
    setIsLoading(true)
    fetchAnalytics()
  }, [fetchAnalytics])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchAnalytics()
  }

  const hasStripe = data?.stripe !== null
  const hasTracker = data?.tracker !== null

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
        <div className="flex items-center gap-4">
          <Link href={`/admin/${cohortSlug}/startups/${slug}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Startup
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">Startup performance metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* No Data */}
      {!hasStripe && !hasTracker && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground">
                No integrations connected. Metrics will appear here once the startup connects Stripe
                or adds the AccelerateMe Tracker.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stripe Metrics */}
      {hasStripe && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Revenue Metrics
            </h2>
          </div>

          {data?.stripe?.revenue && (
            <MetricChart
              title="Total Revenue"
              description="Cumulative revenue over time"
              data={data.stripe.revenue}
              formatValue={(v) =>
                `£${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
            />
          )}

          {data?.stripe?.mrr && (
            <MetricChart
              title="Monthly Recurring Revenue (MRR)"
              description="Recurring revenue from subscriptions"
              data={data.stripe.mrr}
              formatValue={(v) =>
                `£${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
            />
          )}

          {data?.stripe?.customers && (
            <MetricChart
              title="Active Customers"
              description="Number of active paying customers"
              data={data.stripe.customers}
              formatValue={(v) => v.toLocaleString()}
            />
          )}
        </div>
      )}

      {/* Tracker Metrics */}
      {hasTracker && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Eye className="h-6 w-6" />
              Traffic Metrics
            </h2>
          </div>

          {data?.tracker?.sessions && (
            <MetricChart
              title="Sessions"
              description="Total number of user sessions"
              data={data.tracker.sessions}
              formatValue={(v) => v.toLocaleString()}
            />
          )}

          {data?.tracker?.users && (
            <MetricChart
              title="Active Users"
              description="Number of unique active users"
              data={data.tracker.users}
              formatValue={(v) => v.toLocaleString()}
            />
          )}

          {data?.tracker?.pageviews && (
            <MetricChart
              title="Page Views"
              description="Total number of page views"
              data={data.tracker.pageviews}
              formatValue={(v) => v.toLocaleString()}
            />
          )}
        </div>
      )}
    </div>
  )
}
