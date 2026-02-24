'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

export default function Home() {
  const { userId, isLoaded } = useAuth()
  const user = useQuery(api.users.current)
  // Give ensureUser time to create the record before giving up
  const [waitCount, setWaitCount] = useState(0)

  useEffect(() => {
    if (!isLoaded) return

    if (!userId) {
      window.location.href = '/login'
      return
    }

    // Wait for Convex query to resolve
    if (user === undefined) return

    if (user) {
      // User found — redirect based on role
      if (user.role === 'founder') {
        window.location.href = '/founder/dashboard'
      } else {
        window.location.href = '/admin'
      }
      return
    }

    // user is null — record doesn't exist yet.
    // EnsureUser mutation is running in the background.
    // Wait for the reactive query to pick up the new record.
    if (waitCount < 10) {
      const timer = setTimeout(() => setWaitCount((c) => c + 1), 500)
      return () => clearTimeout(timer)
    }

    // After 5 seconds of waiting, give up
    window.location.href = '/access-required'
  }, [userId, isLoaded, user, waitCount])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-sm text-muted-foreground">Redirecting...</div>
    </div>
  )
}
