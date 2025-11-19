import { createClient } from '@/lib/supabase/server'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  
  // Get all startups with their goals and metrics
  const { data: startups } = await supabase
    .from('startups')
    .select('id, name, logo_url, website_url, cohort_id, cohorts(name)')
    .order('name')

  if (!startups || startups.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Leaderboard</h1>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500">No startups found.</p>
        </div>
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
    <div>
      <h1 className="text-2xl font-bold mb-6">Leaderboard</h1>

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

