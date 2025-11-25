/**
 * Supabase Realtime integration for TanStack Query
 *
 * This module sets up realtime subscriptions for key database tables
 * and updates the TanStack Query cache when changes occur.
 */

import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'
import { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { Cohort, GoalTemplate } from '@/lib/types'

export interface RealtimeSubscriptions {
  cohorts: RealtimeChannel | null
  goals: RealtimeChannel | null
  startupGoals: RealtimeChannel | null
}

/**
 * Set up realtime subscriptions for cohorts
 */
export function setupCohortsRealtime(queryClient: QueryClient): RealtimeChannel | null {
  const supabase = createClient()

  const channel = supabase
    .channel('cohorts-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'cohorts',
      },
      (payload) => {
        console.warn('Cohort change detected:', payload)

        // Invalidate cohorts list cache
        queryClient.invalidateQueries({ queryKey: queryKeys.cohorts.lists() })

        // If it's a delete, invalidate the detail cache using old_record
        if (payload.eventType === 'DELETE' && 'old_record' in payload) {
          const oldRecord = payload.old_record as Cohort
          if (oldRecord?.slug) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.cohorts.detail(oldRecord.slug),
            })
          }
        }

        // If it's an insert or update, invalidate the new detail cache
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          // INSERT events have 'record', UPDATE events have 'new_record'
          const newRecord = (
            payload.eventType === 'INSERT'
              ? (payload as any).record
              : 'new_record' in payload
                ? payload.new_record
                : null
          ) as Cohort | null
          if (newRecord?.slug) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.cohorts.detail(newRecord.slug),
            })
          }
        }
      }
    )
    .subscribe()

  return channel
}

/**
 * Set up realtime subscriptions for goal templates
 */
export function setupGoalsRealtime(queryClient: QueryClient): RealtimeChannel | null {
  const supabase = createClient()

  const channel = supabase
    .channel('goal-templates-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'goal_templates',
      },
      (payload) => {
        console.warn('Goal template change detected:', payload)

        // Invalidate admin goals list cache
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.list('admin') })

        // If it's a delete, invalidate the detail cache using old_record
        if (payload.eventType === 'DELETE' && 'old_record' in payload) {
          const oldRecord = payload.old_record as GoalTemplate
          if (oldRecord?.id) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.goals.detail(oldRecord.id),
            })
          }
        }

        // If it's an insert or update, invalidate the new detail cache
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          // INSERT events have 'record', UPDATE events have 'new_record'
          const newRecord = (
            payload.eventType === 'INSERT'
              ? (payload as any).record
              : 'new_record' in payload
                ? payload.new_record
                : null
          ) as GoalTemplate | null
          if (newRecord?.id) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.goals.detail(newRecord.id),
            })
          }
        }
      }
    )
    .subscribe()

  return channel
}

/**
 * Set up realtime subscriptions for startup goals (founder view)
 */
export function setupStartupGoalsRealtime(queryClient: QueryClient): RealtimeChannel | null {
  const supabase = createClient()

  const channel = supabase
    .channel('startup-goals-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'startup_goals',
      },
      (payload) => {
        console.warn('Startup goal change detected:', payload)

        // Invalidate founder goals list cache
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.list('founder') })

        // Also invalidate admin goals if needed (for admin views of startup goals)
        // This ensures admin views stay in sync when founders update their goals
      }
    )
    .subscribe()

  return channel
}

/**
 * Initialize all realtime subscriptions
 */
export function setupRealtime(queryClient: QueryClient): RealtimeSubscriptions {
  return {
    cohorts: setupCohortsRealtime(queryClient),
    goals: setupGoalsRealtime(queryClient),
    startupGoals: setupStartupGoalsRealtime(queryClient),
  }
}

/**
 * Clean up all realtime subscriptions
 */
export function cleanupRealtime(subscriptions: RealtimeSubscriptions) {
  const supabase = createClient()

  if (subscriptions.cohorts) {
    supabase.removeChannel(subscriptions.cohorts)
  }
  if (subscriptions.goals) {
    supabase.removeChannel(subscriptions.goals)
  }
  if (subscriptions.startupGoals) {
    supabase.removeChannel(subscriptions.startupGoals)
  }
}
