'use client'

import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import { ContributionCalendar } from '@/components/analytics/contribution-calendar'
import { MrrWaterfall } from '@/components/analytics/mrr-waterfall'
import {
  Plug,
  TrendingUp,
  Eye,
  Github,
  CreditCard,
  Ship,
  LayoutDashboard,
} from 'lucide-react'
import Link from 'next/link'

type AnalyticsTab = 'overview' | 'stripe' | 'traffic' | 'shipping'

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

function formatGBP(v: number, decimals = 0): string {
  return `£${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

export default function FounderAnalyticsPage() {
  const [range, setRange] = useState('30')
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview')

  const integrationStatus = useQuery(api.integrations.fullStatus)
  const trackerWebsites = useQuery(api.trackerWebsites.list)
  const startupId = useQuery(api.integrations.getFounderStartupId)

  const isLoading =
    integrationStatus === undefined || trackerWebsites === undefined || startupId === undefined

  const hasStripe = integrationStatus?.stripe?.status === 'active'
  const hasTracker = (trackerWebsites?.length ?? 0) > 0
  const hasGithub = integrationStatus?.github?.status === 'active'
  const hasAnyIntegration = hasStripe || hasTracker || hasGithub

  const startDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - parseInt(range))
    return d.toISOString()
  }, [range])

  const timeSeriesArgs = startupId ? { startupId, window: 'daily' as const, startDate } : null
  const latestArgs = startupId ? { startupId, window: 'daily' as const } : null

  // Stripe metrics
  const mrr = useQuery(
    api.metrics.timeSeries,
    timeSeriesArgs ? { ...timeSeriesArgs, provider: 'stripe' as const, metricKey: 'mrr' } : 'skip'
  )
  const revenue = useQuery(
    api.metrics.timeSeries,
    timeSeriesArgs
      ? { ...timeSeriesArgs, provider: 'stripe' as const, metricKey: 'total_revenue' }
      : 'skip'
  )
  const arr = useQuery(
    api.metrics.getLatest,
    latestArgs ? { ...latestArgs, provider: 'stripe' as const, metricKey: 'arr' } : 'skip'
  )
  const arpu = useQuery(
    api.metrics.getLatest,
    latestArgs ? { ...latestArgs, provider: 'stripe' as const, metricKey: 'arpu' } : 'skip'
  )
  const nrr = useQuery(
    api.metrics.getLatest,
    latestArgs ? { ...latestArgs, provider: 'stripe' as const, metricKey: 'nrr' } : 'skip'
  )
  const ltv = useQuery(
    api.metrics.getLatest,
    latestArgs ? { ...latestArgs, provider: 'stripe' as const, metricKey: 'ltv' } : 'skip'
  )
  const activeCustomers = useQuery(
    api.metrics.getLatest,
    latestArgs
      ? { ...latestArgs, provider: 'stripe' as const, metricKey: 'active_customers' }
      : 'skip'
  )
  const activeSubscriptions = useQuery(
    api.metrics.getLatest,
    latestArgs
      ? { ...latestArgs, provider: 'stripe' as const, metricKey: 'active_subscriptions' }
      : 'skip'
  )
  const trialConversion = useQuery(
    api.metrics.getLatest,
    latestArgs
      ? { ...latestArgs, provider: 'stripe' as const, metricKey: 'trial_conversion_rate' }
      : 'skip'
  )
  const paymentFailure = useQuery(
    api.metrics.getLatest,
    latestArgs
      ? { ...latestArgs, provider: 'stripe' as const, metricKey: 'payment_failure_rate' }
      : 'skip'
  )
  const churnRate = useQuery(
    api.metrics.getLatest,
    latestArgs
      ? { ...latestArgs, provider: 'stripe' as const, metricKey: 'monthly_churn_rate' }
      : 'skip'
  )

  // MRR movements
  const mrrMovements = useQuery(api.metrics.getMrrMovements, startupId ? { startupId } : 'skip')

  // Tracker metrics
  const sessions = useQuery(
    api.metrics.timeSeries,
    timeSeriesArgs
      ? { ...timeSeriesArgs, provider: 'tracker' as const, metricKey: 'sessions' }
      : 'skip'
  )
  const pageviews = useQuery(
    api.metrics.timeSeries,
    timeSeriesArgs
      ? { ...timeSeriesArgs, provider: 'tracker' as const, metricKey: 'pageviews' }
      : 'skip'
  )

  // GitHub metrics — server-side rolling window velocity (single source of truth)
  const velocityTimeSeries = useQuery(
    api.metrics.getVelocityTimeSeries,
    startupId ? { startupId, startDate } : 'skip'
  )
  const commits = useQuery(
    api.metrics.getLatest,
    latestArgs ? { ...latestArgs, provider: 'github' as const, metricKey: 'commits' } : 'skip'
  )
  const prsOpened = useQuery(
    api.metrics.getLatest,
    latestArgs ? { ...latestArgs, provider: 'github' as const, metricKey: 'prs_opened' } : 'skip'
  )
  const reviews = useQuery(
    api.metrics.getLatest,
    latestArgs ? { ...latestArgs, provider: 'github' as const, metricKey: 'reviews' } : 'skip'
  )
  const contributionCalendar = useQuery(
    api.metrics.getContributionCalendar,
    startupId ? { startupId } : 'skip'
  )


  // Compute earliest data point to determine which range options have data
  // MUST be before the early return to avoid conditional hook calls
  const earliestDataDate = useMemo(() => {
    const dates: number[] = []
    if (integrationStatus?.stripe?.connectedAt) {
      dates.push(new Date(integrationStatus.stripe.connectedAt).getTime())
    }
    if (integrationStatus?.github?.connectedAt) {
      dates.push(new Date(integrationStatus.github.connectedAt).getTime())
    }
    if (mrr?.length) dates.push(new Date(mrr[0].timestamp).getTime())
    if (sessions?.length) dates.push(new Date(sessions[0].timestamp).getTime())
    if (velocityTimeSeries?.length)
      dates.push(new Date(velocityTimeSeries[0].timestamp).getTime())
    return dates.length > 0 ? Math.min(...dates) : null
  }, [integrationStatus, mrr, sessions, velocityTimeSeries])

  // Compute velocity % change vs last week from contribution calendar
  // MUST be before the early return to avoid conditional hook calls
  const velocityChange = useMemo(() => {
    if (!contributionCalendar || contributionCalendar.length < 5) return 0
    const allDays = contributionCalendar
      .flatMap((w: any) =>
        (w.contributionDays ?? []).map((d: any) => ({
          date: d.date,
          count: d.contributionCount ?? 0,
        }))
      )
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
    if (allDays.length < 14) return 0
    const thisWeek = allDays.slice(-7).reduce((s: number, d: any) => s + d.count, 0)
    const lastWeek = allDays.slice(-14, -7).reduce((s: number, d: any) => s + d.count, 0)
    if (lastWeek === 0) return thisWeek > 0 ? 100 : 0
    return ((thisWeek - lastWeek) / lastWeek) * 100
  }, [contributionCalendar])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48 mb-2" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  const latestMrr = mrr?.length ? mrr[mrr.length - 1].value : 0
  const latestSessions = sessions?.length ? sessions[sessions.length - 1].value : 0
  const latestVelocity = velocityTimeSeries?.length ? velocityTimeSeries[velocityTimeSeries.length - 1].value : 0

  // Current month MRR movements for waterfall
  const currentMonth = new Date().toISOString().slice(0, 7)
  const currentMovements = mrrMovements?.filter((m) => m.month === currentMonth) ?? []

  const dataDaysAvailable = earliestDataDate
    ? Math.floor((Date.now() - earliestDataDate) / 86400000)
    : 0

  const rangeOptions = [
    { value: '7', label: 'Last 7 days', days: 7 },
    { value: '30', label: 'Last 30 days', days: 30 },
    { value: '90', label: 'Last 3 months', days: 90 },
    { value: '180', label: 'Last 6 months', days: 180 },
    { value: '365', label: 'Last 12 months', days: 365 },
  ]

  const tabItems: { key: AnalyticsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: 'stripe', label: 'Revenue', icon: <CreditCard className="h-4 w-4" /> },
    { key: 'traffic', label: 'Traffic', icon: <Eye className="h-4 w-4" /> },
    { key: 'shipping', label: 'Shipping', icon: <Ship className="h-4 w-4" /> },
  ]

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
              {rangeOptions.map((opt) => {
                const hasData = dataDaysAvailable >= opt.days || opt.days <= 7
                return (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    disabled={!hasData}
                    title={!hasData ? `Not enough data — connected ${dataDaysAvailable} days ago` : undefined}
                  >
                    {opt.label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* No integrations prompt */}
      {!hasAnyIntegration && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Plug className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Integrations Connected</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Connect your tools to start tracking performance automatically.
              </p>
              <Link href="/founder/integrations">
                <Button>Set Up Integrations</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {hasAnyIntegration && (
        <>
          {/* Tabs */}
          <div className="border-b">
            <nav className="flex gap-4">
              {tabItems.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors cursor-pointer ${
                    activeTab === tab.key
                      ? 'border-primary text-primary font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* ── Overview Tab ──────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {hasStripe && (
                  <KpiCard
                    title="MRR"
                    value={formatGBP(latestMrr, 2)}
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
                    title="Velocity Score"
                    value={`${latestVelocity} pts`}
                    change={velocityChange}
                    sparklineData={toSparkline(velocityTimeSeries)}
                    color="hsl(var(--chart-3))"
                  />
                )}
              </div>

              {hasStripe && mrr && mrr.length > 0 && (
                <MetricAreaChart
                  title="Monthly Recurring Revenue"
                  description="MRR from active subscriptions"
                  data={mrr.map((d) => ({ timestamp: d.timestamp, value: d.value }))}
                  formatValue={(v) => formatGBP(v)}
                  color="hsl(var(--chart-1))"
                />
              )}

              {hasTracker && sessions && sessions.length > 0 && (
                <MetricAreaChart
                  title="Website Traffic"
                  description="Sessions over time"
                  data={sessions.map((d) => ({ timestamp: d.timestamp, value: d.value }))}
                  color="hsl(var(--chart-2))"
                  height={250}
                />
              )}
              {hasGithub && (
                <VelocityScore
                  commits={commits ?? 0}
                  prsOpened={prsOpened ?? 0}
                  reviews={reviews ?? 0}
                  totalScore={latestVelocity}
                />
              )}

              {/* Integration nudges */}
              {!hasStripe && (
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <TrendingUp className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Track revenue automatically</p>
                        <p className="text-sm text-muted-foreground">
                          Connect Stripe for MRR, ARR, and customer metrics.
                        </p>
                      </div>
                      <Link href="/founder/integrations">
                        <Button variant="outline" size="sm">
                          Connect Stripe
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
              {!hasTracker && (
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <Eye className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Track website traffic</p>
                        <p className="text-sm text-muted-foreground">
                          Add the tracker to monitor sessions and pageviews.
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
              {!hasGithub && (
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <Github className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Track development velocity</p>
                        <p className="text-sm text-muted-foreground">
                          Connect GitHub to score commits, PRs, and code reviews on the leaderboard.
                        </p>
                      </div>
                      <Link href="/founder/integrations?tab=github">
                        <Button variant="outline" size="sm">
                          Connect GitHub
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── Revenue (Stripe) Tab ─────────────────────────── */}
          {activeTab === 'stripe' && (
            <div className="space-y-4">
              {!hasStripe ? (
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <CreditCard className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium mb-1">Stripe not connected</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Connect Stripe to track MRR, ARR, customers, and more.
                      </p>
                      <Link href="/founder/integrations">
                        <Button variant="outline" size="sm">
                          Connect Stripe
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* KPI row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard
                      title="MRR"
                      value={formatGBP(latestMrr, 2)}
                      change={computeGrowth(mrr)}
                      sparklineData={toSparkline(mrr)}
                      color="hsl(var(--chart-1))"
                    />
                    <KpiCard title="ARR" value={formatGBP(arr ?? 0)} color="hsl(var(--chart-1))" />
                    <KpiCard
                      title="Active Customers"
                      value={(activeCustomers ?? 0).toLocaleString()}
                      color="hsl(var(--chart-2))"
                    />
                    <KpiCard
                      title="Active Subscriptions"
                      value={(activeSubscriptions ?? 0).toLocaleString()}
                      color="hsl(var(--chart-3))"
                    />
                  </div>

                  {/* MRR chart */}
                  {mrr && mrr.length > 0 && (
                    <MetricAreaChart
                      title="Monthly Recurring Revenue"
                      description="MRR from active subscriptions"
                      data={mrr.map((d) => ({ timestamp: d.timestamp, value: d.value }))}
                      formatValue={(v) => formatGBP(v)}
                      color="hsl(var(--chart-1))"
                    />
                  )}

                  {/* Revenue chart */}
                  {revenue && revenue.length > 0 && (
                    <MetricAreaChart
                      title="Total Revenue"
                      description="Cumulative paid invoice revenue"
                      data={revenue.map((d) => ({ timestamp: d.timestamp, value: d.value }))}
                      formatValue={(v) => formatGBP(v)}
                      color="hsl(var(--chart-2))"
                    />
                  )}

                  {/* MRR waterfall — startingMrr uses last value before current month */}
                  {currentMovements.length > 0 && mrr && mrr.length > 0 && (
                    <MrrWaterfall
                      startingMrr={(() => {
                        // Find the last MRR snapshot before the current month
                        const monthStart = currentMonth + '-01'
                        const priorValues = mrr.filter((m) => m.timestamp < monthStart)
                        const priorMrr =
                          priorValues.length > 0
                            ? priorValues[priorValues.length - 1].value
                            : mrr[0].value
                        return priorMrr * 100 // Convert pounds to pence (movements are in pence)
                      })()}
                      movements={currentMovements.map((m) => ({
                        type: m.type,
                        amount: m.amount,
                      }))}
                    />
                  )}

                  {/* Derived metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">ARPU</p>
                        <p className="text-xl font-bold">{formatGBP(arpu ?? 0, 2)}</p>
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
                          {ltv != null && ltv !== -1 ? formatGBP(ltv) : '—'}
                        </p>
                        {(ltv == null || ltv === -1) && (
                          <p className="text-xs text-muted-foreground">Needs churn data</p>
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
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Traffic Tab ───────────────────────────────────── */}
          {activeTab === 'traffic' && (
            <div className="space-y-4">
              {!hasTracker ? (
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Eye className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium mb-1">Tracker not set up</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Add the tracker to your website to monitor sessions and pageviews.
                      </p>
                      <Link href="/founder/integrations?tab=tracker">
                        <Button variant="outline" size="sm">
                          Set Up Tracker
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <KpiCard
                      title="Sessions"
                      value={latestSessions.toLocaleString()}
                      change={computeGrowth(sessions)}
                      sparklineData={toSparkline(sessions)}
                      color="hsl(var(--chart-2))"
                    />
                    <KpiCard
                      title="Pageviews"
                      value={
                        pageviews?.length
                          ? pageviews[pageviews.length - 1].value.toLocaleString()
                          : '0'
                      }
                      change={computeGrowth(pageviews)}
                      sparklineData={toSparkline(pageviews)}
                      color="hsl(var(--chart-3))"
                    />
                  </div>

                  {sessions && sessions.length > 0 && (
                    <MetricAreaChart
                      title="Sessions"
                      description="Unique sessions per day"
                      data={sessions.map((d) => ({ timestamp: d.timestamp, value: d.value }))}
                      color="hsl(var(--chart-2))"
                    />
                  )}

                  {pageviews && pageviews.length > 0 && (
                    <MetricAreaChart
                      title="Pageviews"
                      description="Total page views per day"
                      data={pageviews.map((d) => ({ timestamp: d.timestamp, value: d.value }))}
                      color="hsl(var(--chart-3))"
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Shipping Tab ──────────────────────────────────── */}
          {activeTab === 'shipping' && (
            <div className="space-y-4">
              {!hasGithub ? (
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Github className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium mb-1">GitHub not connected</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Connect GitHub to track development velocity, commits, and PRs.
                      </p>
                      <Link href="/founder/integrations?tab=github">
                        <Button variant="outline" size="sm">
                          Connect GitHub
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <VelocityScore
                    commits={commits ?? 0}
                    prsOpened={prsOpened ?? 0}
                    reviews={reviews ?? 0}
                    totalScore={latestVelocity}
                  />

                  {/* Shipping Activity — server-side rolling window velocity */}
                  {velocityTimeSeries && velocityTimeSeries.length > 0 && (
                    <MetricAreaChart
                      title="Shipping Activity"
                      description="Daily velocity score — 4-week rolling window with temporal decay"
                      data={velocityTimeSeries}
                      color="hsl(var(--primary))"
                      formatValue={(v) => `${v.toLocaleString()} pts`}
                    />
                  )}

                  {contributionCalendar && <ContributionCalendar weeks={contributionCalendar} />}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
