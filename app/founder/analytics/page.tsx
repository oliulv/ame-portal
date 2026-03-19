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
import { SocialCard } from '@/components/analytics/social-card'
import { VelocityScore } from '@/components/analytics/velocity-score'
import { Plug, TrendingUp, Eye, Github } from 'lucide-react'
import Link from 'next/link'

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

export default function FounderAnalyticsPage() {
  const [range, setRange] = useState('30')

  const integrationStatus = useQuery(api.integrations.fullStatus)
  const trackerWebsites = useQuery(api.trackerWebsites.list)
  const startupId = useQuery(api.integrations.getFounderStartupId)

  const isLoading =
    integrationStatus === undefined || trackerWebsites === undefined || startupId === undefined

  const hasStripe = integrationStatus?.stripe?.status === 'active'
  const hasTracker = (trackerWebsites?.length ?? 0) > 0
  const hasGithub = integrationStatus?.github?.status === 'active'
  const hasSocial = (integrationStatus?.social?.length ?? 0) > 0
  const hasAnyIntegration = hasStripe || hasTracker || hasGithub || hasSocial

  const startDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - parseInt(range))
    return d.toISOString()
  }, [range])

  // timeSeries args include startDate; getLatest args do not
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

  // GitHub metrics
  const velocityScore = useQuery(
    api.metrics.timeSeries,
    timeSeriesArgs
      ? { ...timeSeriesArgs, provider: 'github' as const, metricKey: 'velocity_score' }
      : 'skip'
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

  // Social metrics — per platform
  const twitterFollowers = useQuery(
    api.metrics.getLatest,
    latestArgs
      ? { ...latestArgs, provider: 'apify' as const, metricKey: 'twitter_followers' }
      : 'skip'
  )
  const instagramFollowers = useQuery(
    api.metrics.getLatest,
    latestArgs
      ? { ...latestArgs, provider: 'apify' as const, metricKey: 'instagram_followers' }
      : 'skip'
  )
  const linkedinFollowers = useQuery(
    api.metrics.getLatest,
    latestArgs
      ? { ...latestArgs, provider: 'apify' as const, metricKey: 'linkedin_followers' }
      : 'skip'
  )

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
  const latestVelocity = velocityScore?.length ? velocityScore[velocityScore.length - 1].value : 0

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
          {/* Row 1: KPI Cards */}
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
                title="Velocity Score"
                value={`${latestVelocity} pts`}
                change={computeGrowth(velocityScore)}
                sparklineData={toSparkline(velocityScore)}
                color="hsl(var(--chart-3))"
              />
            )}
            {hasSocial && (
              <KpiCard
                title="Social Followers"
                value={(
                  (twitterFollowers ?? 0) +
                  (instagramFollowers ?? 0) +
                  (linkedinFollowers ?? 0)
                ).toLocaleString()}
                color="hsl(var(--chart-4))"
              />
            )}
          </div>

          {/* Row 2: Revenue area chart */}
          {hasStripe && mrr && mrr.length > 0 && (
            <MetricAreaChart
              title="Monthly Recurring Revenue"
              description="MRR from active subscriptions"
              data={mrr.map((d) => ({ timestamp: d.timestamp, value: d.value }))}
              formatValue={(v) =>
                `£${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              }
              color="hsl(var(--chart-1))"
            />
          )}

          {/* Row 3: Traffic + GitHub */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                prsMerged={0}
                reviews={reviews ?? 0}
                totalScore={latestVelocity}
              />
            )}
          </div>

          {/* Row 4: Social platform cards */}
          {hasSocial && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {integrationStatus?.social?.map((profile) => {
                const followers =
                  profile.platform === 'twitter'
                    ? (twitterFollowers ?? 0)
                    : profile.platform === 'instagram'
                      ? (instagramFollowers ?? 0)
                      : profile.platform === 'linkedin'
                        ? (linkedinFollowers ?? 0)
                        : 0
                return (
                  <SocialCard
                    key={profile._id}
                    platform={profile.platform}
                    handle={profile.handle}
                    followers={followers}
                  />
                )
              })}
            </div>
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
        </>
      )}
    </div>
  )
}
