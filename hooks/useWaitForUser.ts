'use client'

import { useState, useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

export function useWaitForUser() {
  const user = useQuery(api.users.current)
  const [waitCount, setWaitCount] = useState(0)

  useEffect(() => {
    if (user === undefined || user) return
    if (waitCount < 20) {
      const timer = setTimeout(() => setWaitCount((c) => c + 1), 500)
      return () => clearTimeout(timer)
    }
  }, [user, waitCount])

  return {
    user,
    isLoading: user === undefined || (!user && waitCount < 20),
    timedOut: !user && waitCount >= 20,
  }
}
