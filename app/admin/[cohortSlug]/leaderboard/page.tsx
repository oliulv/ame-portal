import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Users, Plus } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  params: Promise<{
    cohortSlug: string
  }>
}

export default async function LeaderboardPage({ params }: PageProps) {
  const { cohortSlug } = await params
  
  const supabase = await createClient()
  
  // Verify cohort exists - use Supabase directly for server-side calls
  const { data: cohort, error: cohortError } = await supabase
    .from('cohorts')
    .select('*')
    .eq('slug', cohortSlug)
    .single()

  if (cohortError || !cohort) {
    // Cohort doesn't exist, redirect to cohorts page
    redirect('/admin/cohorts')
  }
  
  // Get startups in this cohort with their goals and metrics
  const { data: startups } = await supabase
    .from('startups')
    .select('id, name, logo_url, website_url, cohort_id, cohorts(name)')
    .eq('cohort_id', cohort.id)
    .order('name')

  if (!startups || startups.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground">
            Track startup progress and performance for {cohort.label}
          </p>
        </div>

        {/* Empty State */}
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No startups enrolled"
          description="There are no startups enrolled in this cohort yet. Invite startups to start tracking their progress on the leaderboard."
          action={
            <Link href={`/admin/${cohortSlug}/startups`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                View Startups
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  // Calculate scores for each startup
  const startupScores = await Promise.all(
    startups.map(async (startup) => {
      const [goalsResult, manualMetricsResult, stripeMetricsResult, gaMetricsResult] = await Promise.all([
        supabase
          .from('startup_goals')
          .select('status, completion_source, data_source')
          .eq('startup_id', startup.id),
        supabase
          .from('startup_metrics_manual')
          .select('metric_name, metric_value')
          .eq('startup_id', startup.id),
        supabase
          .from('metrics_data')
          .select('metric_key, value')
          .eq('startup_id', startup.id)
          .eq('provider', 'stripe')
          .order('timestamp', { ascending: false })
          .limit(10),
        supabase
          .from('metrics_data')
          .select('metric_key, value')
          .eq('startup_id', startup.id)
          .eq('provider', 'tracker')
          .order('timestamp', { ascending: false })
          .limit(10),
      ])

      const goals = goalsResult.data || []
      const manualMetrics = manualMetricsResult.data || []
      const stripeMetrics = stripeMetricsResult.data || []
      const gaMetrics = gaMetricsResult.data || []

      const completedGoals = goals.filter(g => g.status === 'completed').length
      const autoCompletedGoals = goals.filter(g => g.status === 'completed' && g.completion_source === 'auto').length
      const totalGoals = goals.length
      const completionPercentage = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0

      // Get revenue from manual metrics or Stripe metrics
      let revenue = 0
      const manualRevenueMetric = manualMetrics.find(m => m.metric_name === 'manual_revenue')
      if (manualRevenueMetric) {
        revenue = Number(manualRevenueMetric.metric_value)
      } else {
        // Try to get from Stripe metrics
        const stripeRevenue = stripeMetrics.find(m => m.metric_key === 'total_revenue')
        if (stripeRevenue) {
          revenue = Number(stripeRevenue.value)
        }
      }

      // Get traffic metrics from tracker
      const sessionsMetric = gaMetrics.find(m => m.metric_key === 'sessions')
      const sessions = sessionsMetric ? Number(sessionsMetric.value) : 0

      // Enhanced scoring formula:
      // - Goal completion: 40% weight (normalized to 0-40 points)
      // - Revenue: 30% weight (normalized, £1000 = 30 points, capped)
      // - Traffic: 20% weight (normalized, 1000 sessions = 20 points, capped)
      // - Auto-completed goals bonus: 10% weight (bonus for metric-based automation)
      const goalScore = completionPercentage * 0.4
      const revenueScore = Math.min((revenue / 1000) * 30, 30)
      const trafficScore = Math.min((sessions / 1000) * 20, 20)
      const automationBonus = totalGoals > 0 ? (autoCompletedGoals / totalGoals) * 10 : 0

      const score = goalScore + revenueScore + trafficScore + automationBonus

      return {
        ...startup,
        completionPercentage,
        autoCompletedGoals,
        totalGoals,
        revenue,
        sessions,
        score,
      }
    })
  )

  // Sort by score (descending)
  startupScores.sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground">
          Track startup progress and performance for {cohort.label}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Startup
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Goals Completion
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Revenue
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Traffic
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Score
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {startupScores.map((startup, index) => (
              <tr key={startup.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  #{index + 1}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {startup.logo_url && (
                      <img
                        src={startup.logo_url}
                        alt={startup.name}
                        className="h-10 w-10 rounded-full mr-3"
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{startup.name}</div>
                      {startup.website_url && (
                        <a
                          href={startup.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {startup.website_url}
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <span>{startup.completionPercentage.toFixed(1)}%</span>
                    {startup.autoCompletedGoals > 0 && (
                      <span
                        className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded"
                        title={`${startup.autoCompletedGoals} goal(s) auto-completed via metrics`}
                      >
                        {startup.autoCompletedGoals} auto
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  £{startup.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {startup.sessions > 0 ? startup.sessions.toLocaleString() : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {startup.score.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-600 mb-2">
          <strong>Scoring Formula:</strong> Leaderboard score combines multiple factors:
        </p>
        <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
          <li><strong>Goal Completion (40%):</strong> Percentage of completed goals</li>
          <li><strong>Revenue (30%):</strong> From Stripe integration or manual entry (£1000 = 30 points, capped)</li>
          <li><strong>Traffic (20%):</strong> Sessions from AccelerateMe Tracker (1000 sessions = 20 points, capped)</li>
          <li><strong>Automation Bonus (10%):</strong> Bonus for goals auto-completed via metric tracking</li>
        </ul>
        <p className="text-sm text-gray-600 mt-2">
          Goals marked with "auto" badges are automatically completed when metric thresholds are met.
        </p>
      </div>
    </div>
  )
}

