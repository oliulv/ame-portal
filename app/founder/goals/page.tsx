'use client'

import { useQuery } from '@tanstack/react-query'
import { Check, Clock, MinusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StartupGoal } from '@/lib/types'
import { queryKeys } from '@/lib/queryKeys'
import { goalsApi } from '@/lib/api/goals'

export default function FounderGoalsPage() {
  const { data: goals = [], isLoading, error } = useQuery({
    queryKey: queryKeys.goals.list('founder'),
    queryFn: () => goalsApi.getFounderGoals(),
    staleTime: 1000 * 60, // 1 minute - goals can change, but realtime handles most updates
    refetchInterval: 1000 * 60 * 2, // Refetch every 2 minutes as fallback
    refetchOnWindowFocus: true,
  })

  if (isLoading) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-8">Goals Checklist</h1>
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <p className="text-gray-500">Loading goals...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-8">Goals Checklist</h1>
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <p className="text-red-500">Error: {error instanceof Error ? error.message : 'Failed to load goals'}</p>
        </div>
      </div>
    )
  }

  // We always have at least the initial goal, but if for some reason state is cleared:
  if (goals.length === 0) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-8">Goals Checklist</h1>
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <p className="text-gray-500">No goals found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-8">Goals Checklist</h1>

      <div className="flow-root">
        <ul role="list" className="-mb-8">
          {goals.map((goal, goalIdx) => {
            // Calculate progress for the connecting line to the NEXT goal
            const nextGoal = goals[goalIdx + 1]
            let lineProgress = 0
            
            if (nextGoal) {
              if (nextGoal.status === 'completed') {
                lineProgress = 100
              } else if (nextGoal.target_value && nextGoal.target_value > 0) {
                lineProgress = Math.min(100, ((nextGoal.progress_value || 0) / nextGoal.target_value) * 100)
              } else if (nextGoal.status === 'in_progress') {
                 // If in progress but no numeric target, show some progress (e.g. 50%) or just 0 if strictly metric based.
                 // Let's stick to 0 for the line unless there's a metric, or maybe 50% to show activity?
                 // User asked for "progress towards next goal via the colour moving", implying metric.
                 lineProgress = 0 
              }
            }

            return (
              <li key={goal.id}>
                <div className="relative pb-12">
                  {goalIdx !== goals.length - 1 ? (
                    <>
                      {/* Background Line */}
                      <span
                        className="absolute top-12 left-6 -ml-px h-full w-0.5 bg-gray-200"
                        aria-hidden="true"
                      />
                      {/* Progress Line */}
                      <span
                        className="absolute top-12 left-6 -ml-px w-0.5 bg-blue-500 transition-all duration-500"
                        style={{ height: `calc(${lineProgress}% - 48px)` /* Adjust calculation to be relative to segment length if needed, but h-full is easier */ }}
                        aria-hidden="true"
                      >
                        {/* We need a better way to limit height to the segment. 
                            'h-full' covers the whole segment. 
                            We want 'height: lineProgress%'.
                        */}
                        <div 
                           className="absolute top-0 left-0 w-full bg-blue-500 transition-all duration-500"
                           style={{ height: `${lineProgress}%` }}
                        />
                      </span>
                       {/* Re-implementing the line logic correctly */}
                       <div className="absolute top-12 left-6 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true">
                          <div 
                            className="absolute top-0 left-0 w-full bg-blue-500 transition-all duration-500"
                            style={{ height: `${lineProgress}%` }}
                          />
                       </div>
                    </>
                  ) : null}
                  <div className="relative flex space-x-6">
                    <div className="flex items-center justify-center">
                      {goal.status === 'completed' ? (
                        <span className={cn(
                          "h-12 w-12 rounded-full flex items-center justify-center ring-8 ring-white z-10",
                          goal.id === 'goal-join-accelerateme' ? "bg-indigo-600" : "bg-green-500"
                        )}>
                          <Check className="h-6 w-6 text-white" aria-hidden="true" />
                        </span>
                      ) : goal.status === 'in_progress' ? (
                        <span className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white z-10">
                          <Clock className="h-6 w-6 text-white" aria-hidden="true" />
                        </span>
                      ) : goal.status === 'waived' ? (
                        <span className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center ring-8 ring-white z-10">
                          <MinusCircle className="h-6 w-6 text-gray-500" aria-hidden="true" />
                        </span>
                      ) : (
                        <span className="h-12 w-12 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center ring-8 ring-white z-10">
                          <span className="text-lg font-bold text-gray-500">
                            {goalIdx} {/* Index matches step number if we start at 0 (Join) as 0 */}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-2">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className={cn(
                            "text-xl font-semibold",
                            goal.status === 'completed' ? "text-gray-900" : "text-gray-900"
                          )}>
                            {goal.title}
                          </h3>
                          <span className={cn(
                            "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
                            goal.status === 'completed' ? "bg-green-100 text-green-800" :
                            goal.status === 'in_progress' ? "bg-blue-100 text-blue-800" :
                            goal.status === 'waived' ? "bg-gray-100 text-gray-800" :
                            "bg-gray-100 text-gray-800"
                          )}>
                            {goal.status.replace('_', ' ')}
                          </span>
                        </div>
                        
                        {goal.description && (
                          <div className="text-base text-gray-500 mb-3">
                            {goal.description}
                          </div>
                        )}

                        {(goal.target_value || goal.deadline) && (
                          <div className="flex flex-wrap gap-6 mt-3 text-sm text-gray-500">
                            {goal.target_value && (
                              <div className="flex flex-col gap-1 w-full max-w-md">
                                <div className="flex justify-between text-sm font-medium text-gray-600">
                                  <span>Progress</span>
                                  <span>{goal.progress_value || 0} / {goal.target_value}</span>
                                </div>
                                {goal.target_value > 0 && (
                                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                      className={cn("h-full rounded-full transition-all duration-500", 
                                        goal.status === 'completed' ? "bg-green-500" : "bg-blue-500"
                                      )}
                                      style={{ width: `${Math.min(100, ((goal.progress_value || 0) / goal.target_value) * 100)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                            {goal.deadline && (
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Deadline:</span>
                                <span>{new Date(goal.deadline).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
