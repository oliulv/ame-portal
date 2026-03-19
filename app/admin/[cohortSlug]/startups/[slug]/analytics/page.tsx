'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent } from '@/components/ui/card'
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
import { KpiCard } from '@/components/analytics/kpi-card'
import { MetricAreaChart } from '@/components/analytics/metric-area-chart'
import { VelocityScore } from '@/components/analytics/velocity-score'
import { SocialCard } from '@/components/analytics/social-card'
import { ArrowLeft, RefreshCw, Plug } from 'lucide-react'
import { toast } from 'sonner'

function computeGrowth(data: Array<{ value: number }> | undefined | null): number {
  if (!data || data.length < 2) return 0
  const recent = data[data.length - 1].value
  const previous = data[Math.max(0, data.length - 8)]?.value ?? data[0].value
  if (previous === 0) return 0
  return ((recent - previous) / previous) * 100
}

function toSparkline(data: Array<{ value: number }> | undefined | null): Array<{ value: number }> {
  if (!data) return []
  return data.slice(-14).map((d) => ({ value: d.value }))
}

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

  const tsArgs = startupId ? { startupId, window: 'daily' as const, startDate } : null
  const latArgs = startupId ? { startupId, window: 'daily' as const } : null

  // Stripe
  const mrr = useQuery(
    api.metrics.timeSeries,
    tsArgs ? { ...tsArgs, provider: 'stripe' as const, metricKey: 'mrr' } : 'skip'
  )
  const revenue = useQuery(
    api.metrics.timeSeries,
    tsArgs ? { ...tsArgs, provider: 'stripe' as const, metricKey: 'total_revenue' } : 'skip'
  )
  const arr = useQuery(
    api.metrics.getLatest,
    latArgs ? { ...latArgs, provider: 'stripe' as const, metricKey: 'arr' } : 'skip'
  )
  const arpu = useQuery(
    api.metrics.getLatest,
    latArgs ? { ...latArgs, provider: 'stripe' as const, metricKey: 'arpu' } : 'skip'
  )
  const nrr = useQuery(
    api.metrics.getLatest,
    latArgs ? { ...latArgs, provider: 'stripe' as const, metricKey: 'nrr' } : 'skip'
  )
  const ltv = useQuery(
    api.metrics.getLatest,
    latArgs ? { ...latArgs, provider: 'stripe' as const, metricKey: 'ltv' } : 'skip'
  )
  const trialConversion = useQuery(
    api.metrics.getLatest,
    latArgs
      ? { ...latArgs, provider: 'stripe' as const, metricKey: 'trial_conversion_rate' }
      : 'skip'
  )
  const paymentFailure = useQuery(
    api.metrics.getLatest,
    latArgs
      ? { ...latArgs, provider: 'stripe' as const, metricKey: 'payment_failure_rate' }
      : 'skip'
  )
  const churnRate = useQuery(
    api.metrics.getLatest,
    latArgs ? { ...latArgs, provider: 'stripe' as const, metricKey: 'monthly_churn_rate' } : 'skip'
  )

  // Tracker
  const sessions = useQuery(
    api.metrics.timeSeries,
    tsArgs ? { ...tsArgs, provider: 'tracker' as const, metricKey: 'sessions' } : 'skip'
  )
  const pageviews = useQuery(
    api.metrics.timeSeries,
    tsArgs ? { ...tsArgs, provider: 'tracker' as const, metricKey: 'pageviews' } : 'skip'
  )

  // GitHub
  const velocityScore = useQuery(
    api.metrics.timeSeries,
    tsArgs ? { ...tsArgs, provider: 'github' as const, metricKey: 'velocity_score' } : 'skip'
  )
  const commits = useQuery(
    api.metrics.getLatest,
    latArgs ? { ...latArgs, provider: 'github' as const, metricKey: 'commits' } : 'skip'
  )
  const prsOpened = useQuery(
    api.metrics.getLatest,
    latArgs ? { ...latArgs, provider: 'github' as const, metricKey: 'prs_opened' } : 'skip'
  )
  const reviews = useQuery(
    api.metrics.getLatest,
    latArgs ? { ...latArgs, provider: 'github' as const, metricKey: 'reviews' } : 'skip'
  )

  // Social
  const twitterFollowers = useQuery(
    api.metrics.getLatest,
    latArgs ? { ...latArgs, provider: 'apify' as const, metricKey: 'twitter_followers' } : 'skip'
  )

  const syncMetrics = useAction(api.metrics.syncMetricsForStartup)

  const handleRefresh = async () => {
    if (!startupId) return
    setIsRefreshing(true)
    try {
      await syncMetrics({ startupId })
      toast.success('Metrics synced')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sync')
    } finally {
      setIsRefreshing(false)
    }
  }

  const isLoading = startup === undefined || integrationStatus === undefined
  const hasStripe = integrationStatus?.stripe !== null
  const hasTracker = integrationStatus?.tracker !== null
  const hasGithub = integrationStatus?.github !== null
  const hasSocial = (integrationStatus?.social?.length ?? 0) > 0
  const hasAny = hasStripe || hasTracker || hasGithub || hasSocial

  const latestMrr = mrr?.length ? mrr[mrr.length - 1].value : 0
  const latestSessions = sessions?.length ? sessions[sessions.length - 1].value : 0
  const latestVelocity = velocityScore?.length ? velocityScore[velocityScore.length - 1].value : 0

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48 mb-2" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Link href={`/admin/${cohortSlug}/startups/${slug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Startup
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">Analytics</h1>
            <p className="text-muted-foreground">
              {startup?.name ? `${startup.name} performance metrics` : 'Startup metrics'}
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
              Sync
            </Button>
          </div>
        </div>
      </div>

      {/* Sync status */}
      {integrationStatus?.stripe?.lastSyncedAt && (
        <p className="text-xs text-muted-foreground">
          Last synced: {new Date(integrationStatus.stripe.lastSyncedAt).toLocaleString()}
          {integrationStatus.stripe.syncError && (
            <span className="text-destructive ml-4">
              Error: {integrationStatus.stripe.syncError}
            </span>
          )}
        </p>
      )}

      {!hasAny && (
        <EmptyState
          icon={<Plug className="h-6 w-6" />}
          title="No integrations connected"
          description="Metrics will appear once the startup connects integrations."
        />
      )}

      {hasAny && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {hasStripe && (
              <KpiCard
                title="MRR"
                value={`£${latestMrr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                change={computeGrowth(mrr)}
                sparklineData={toSparkline(mrr)}
                color="hsl(var(--chart-1))"
              />
            )}
            {hasTracker && (
              <KpiCard
                title="Sessions"
                value={latestSessions.toLocaleString()}
                change={computeGrowth(sessions)}
                sparklineData={toSparkline(sessions)}
                color="hsl(var(--chart-2))"
              />
            )}
            {hasGithub && (
              <KpiCard
                title="Velocity"
                value={`${latestVelocity} pts`}
                change={computeGrowth(velocityScore)}
                sparklineData={toSparkline(velocityScore)}
                color="hsl(var(--chart-3))"
              />
            )}
            {hasSocial && (
              <KpiCard
                title="Followers"
                value={(twitterFollowers ?? 0).toLocaleString()}
                color="hsl(var(--chart-4))"
              />
            )}
          </div>

          {/* Revenue chart */}
          {hasStripe && mrr && mrr.length > 0 && (
            <MetricAreaChart
              title="MRR"
              description="Monthly recurring revenue"
              data={mrr.map((d) => ({ timestamp: d.timestamp, value: d.value }))}
              formatValue={(v) => `£${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              color="hsl(var(--chart-1))"
            />
          )}

          {/* Traffic + GitHub */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasTracker && sessions && sessions.length > 0 && (
              <MetricAreaChart
                title="Traffic"
                data={sessions.map((d) => ({ timestamp: d.timestamp, value: d.value }))}
                color="hsl(var(--chart-2))"
                height={250}
              />
            )}
            {hasGithub && (
              <VelocityScore
                commits={commits ?? 0}
                prsOpened={prsOpened ?? 0}
                prsMerged={0}
                reviews={reviews ?? 0}
                totalScore={latestVelocity}
              />
            )}
          </div>

          {/* Social cards */}
          {hasSocial && integrationStatus?.social && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {integrationStatus.social.map((profile: any) => (
                <SocialCard
                  key={profile._id}
                  platform={profile.platform}
                  handle={profile.handle}
                  followers={twitterFollowers ?? 0}
                />
              ))}
            </div>
          )}

          {/* Derived Stripe metrics */}
          {hasStripe && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">ARR</p>
                  <p className="text-xl font-bold">
                    £{(arr ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">ARPU</p>
                  <p className="text-xl font-bold">
                    £{(arpu ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">NRR</p>
                  <p className="text-xl font-bold">
                    {nrr != null && nrr !== -1 ? `${nrr.toFixed(1)}%` : '—'}
                  </p>
                  {(nrr == null || nrr === -1) && (
                    <p className="text-xs text-muted-foreground">Needs 2+ months</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">LTV</p>
                  <p className="text-xl font-bold">
                    {ltv != null && ltv !== -1
                      ? `£${ltv.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : '—'}
                  </p>
                  {(ltv == null || ltv === -1) && (
                    <p className="text-xs text-muted-foreground">Needs churn data</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Trial Conversion</p>
                  <p className="text-xl font-bold">
                    {trialConversion != null && trialConversion !== -1
                      ? `${trialConversion.toFixed(1)}%`
                      : '—'}
                  </p>
                  {(trialConversion == null || trialConversion === -1) && (
                    <p className="text-xs text-muted-foreground">No trials detected</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Payment Failure</p>
                  <p className="text-xl font-bold">
                    {paymentFailure != null && paymentFailure !== -1
                      ? `${paymentFailure.toFixed(1)}%`
                      : '—'}
                  </p>
                  {(paymentFailure == null || paymentFailure === -1) && (
                    <p className="text-xs text-muted-foreground">No invoice data</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Monthly Churn</p>
                  <p className="text-xl font-bold">
                    {churnRate != null && churnRate !== -1 ? `${churnRate.toFixed(1)}%` : '—'}
                  </p>
                  {(churnRate == null || churnRate === -1) && (
                    <p className="text-xs text-muted-foreground">Needs 2+ months</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
