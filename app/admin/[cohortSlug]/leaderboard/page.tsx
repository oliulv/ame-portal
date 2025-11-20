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
      const [goalsResult, metricsResult] = await Promise.all([
        supabase
          .from('startup_goals')
          .select('status')
          .eq('startup_id', startup.id),
        supabase
          .from('startup_metrics_manual')
          .select('metric_name, metric_value')
          .eq('startup_id', startup.id),
      ])

      const goals = goalsResult.data || []
      const metrics = metricsResult.data || []

      const completedGoals = goals.filter(g => g.status === 'completed').length
      const totalGoals = goals.length
      const completionPercentage = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0

      // Get revenue metric if available
      const revenueMetric = metrics.find(m => m.metric_name === 'manual_revenue')
      const revenue = revenueMetric ? Number(revenueMetric.metric_value) : 0

      return {
        ...startup,
        completionPercentage,
        revenue,
        score: completionPercentage + (revenue / 1000), // Simple scoring formula
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
                  {startup.completionPercentage.toFixed(1)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  £{startup.revenue.toLocaleString()}
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
        <p className="text-sm text-gray-600">
          <strong>Note:</strong> Leaderboard scoring is based on goal completion percentage and manual revenue metrics.
          This is a Phase 1 implementation with manual data entry.
        </p>
      </div>
    </div>
  )
}

