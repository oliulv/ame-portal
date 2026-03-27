'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams, useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard } from '@/components/analytics/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function CohortAnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const cohortSlug = params.cohortSlug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const leaderboard = useQuery(
    api.leaderboard.computeLeaderboard,
    cohort ? { cohortId: cohort._id } : 'skip'
  )

  if (cohort === null) {
    router.push('/admin/cohorts')
    return null
  }

  if (cohort === undefined || leaderboard === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    )
  }

  const allStartups = [...(leaderboard?.ranked ?? []), ...(leaderboard?.unranked ?? [])]

  // Aggregate KPIs
  const totalRevenueScore = allStartups.reduce(
    (sum, s) => sum + (s.categories?.revenue?.raw ?? 0),
    0
  )
  const avgTrafficScore =
    allStartups.length > 0
      ? allStartups.reduce((sum, s) => sum + (s.categories?.traffic?.raw ?? 0), 0) /
        allStartups.length
      : 0
  const totalGithubScore = allStartups.reduce((sum, s) => sum + (s.categories?.github?.raw ?? 0), 0)
  // Social scoring excluded from v1
  const avgSocialScore = 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Cohort Analytics</h1>
        <p className="text-muted-foreground">Aggregate metrics for {cohort.label}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Avg Revenue Growth"
          value={`${totalRevenueScore.toFixed(1)}%`}
          color="hsl(var(--chart-1))"
        />
        <KpiCard
          title="Avg Traffic Growth"
          value={`${avgTrafficScore.toFixed(1)}%`}
          color="hsl(var(--chart-2))"
        />
        <KpiCard
          title="Total GitHub Score"
          value={`${totalGithubScore.toFixed(0)} pts`}
          color="hsl(var(--chart-3))"
        />
      </div>

      {/* Startup comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Startup Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr className="text-left">
                  <th className="pb-2 font-medium text-muted-foreground">Startup</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Revenue</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Traffic</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">GitHub</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Updates</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Milestones</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allStartups
                  .sort((a, b) => b.totalScore - a.totalScore)
                  .map((startup) => (
                    <tr
                      key={startup.startupId}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() =>
                        router.push(
                          `/admin/${cohortSlug}/startups/${startup.startupSlug ?? startup.startupId}/analytics`
                        )
                      }
                    >
                      <td className="py-2 font-medium">{startup.startupName}</td>
                      <td className="py-2 text-right">
                        {startup.categories?.revenue?.weighted.toFixed(1)}
                      </td>
                      <td className="py-2 text-right">
                        {startup.categories?.traffic?.weighted.toFixed(1)}
                      </td>
                      <td className="py-2 text-right">
                        {startup.categories?.github?.weighted.toFixed(1)}
                      </td>
                      <td className="py-2 text-right">
                        {startup.categories?.updates?.weighted.toFixed(1)}
                      </td>
                      <td className="py-2 text-right">
                        {startup.categories?.milestones?.weighted.toFixed(1)}
                      </td>
                      <td className="py-2 text-right font-bold">{startup.totalScore.toFixed(1)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
