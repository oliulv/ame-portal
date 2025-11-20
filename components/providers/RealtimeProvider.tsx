'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { setupRealtime, cleanupRealtime, type RealtimeSubscriptions } from '@/lib/realtime'

/**
 * Provider component that sets up Supabase Realtime subscriptions
 * 
 * This should be mounted in the app layout to enable realtime updates
 * across all pages.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const subscriptionsRef = useRef<RealtimeSubscriptions | null>(null)

  useEffect(() => {
    // Set up realtime subscriptions
    subscriptionsRef.current = setupRealtime(queryClient)

    // Cleanup on unmount
    return () => {
      if (subscriptionsRef.current) {
        cleanupRealtime(subscriptionsRef.current)
        subscriptionsRef.current = null
      }
    }
  }, [queryClient])

  return <>{children}</>
}

