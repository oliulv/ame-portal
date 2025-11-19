import { createClient } from '@/lib/supabase/server'
import { getFounderStartupIds } from '@/lib/auth'

export default async function FounderGoalsPage() {
  const startupIds = await getFounderStartupIds()
  const supabase = await createClient()

  if (startupIds.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Goals</h1>
        <p>No startup associated with your account.</p>
      </div>
    )
  }

  const { data: goals } = await supabase
    .from('startup_goals')
    .select('*')
    .in('startup_id', startupIds)
    .order('created_at', { ascending: true })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Goals</h1>

      {goals && goals.length > 0 ? (
        <div className="space-y-4">
          {goals.map((goal) => (
            <div key={goal.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold">{goal.title}</h3>
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    goal.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : goal.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {goal.status.replace('_', ' ')}
                </span>
              </div>
              {goal.description && (
                <p className="text-gray-600 mb-4">{goal.description}</p>
              )}
              {goal.target_value && (
                <div className="text-sm text-gray-500">
                  Progress: {goal.progress_value || 0} / {goal.target_value}
                </div>
              )}
              {goal.deadline && (
                <div className="text-sm text-gray-500 mt-2">
                  Deadline: {new Date(goal.deadline).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-500">No goals assigned yet.</p>
        </div>
      )}
    </div>
  )
}

