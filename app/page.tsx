'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useWaitForUser } from '@/hooks/useWaitForUser'

export default function Home() {
  const { userId, isLoaded } = useAuth()
  const { user, isLoading, timedOut } = useWaitForUser()
  const ensureUser = useMutation(api.users.ensureUser)
  const ensureCalled = useRef(false)

  // Proactively create the Convex user record if Clerk is authed but no user doc exists
  useEffect(() => {
    if (!isLoaded || !userId) return
    if (user !== null || ensureCalled.current) return
    // user === undefined means still loading; user === null means not found
    if (user === undefined) return
    ensureCalled.current = true
    ensureUser().catch(() => {
      // Reset so it can retry if needed
      ensureCalled.current = false
    })
  }, [isLoaded, userId, user, ensureUser])

  useEffect(() => {
    if (!isLoaded) return

    if (!userId) {
      window.location.href = '/login'
      return
    }

    if (isLoading) return

    if (user) {
      if (user.role === 'founder') {
        // Route through onboarding — it auto-redirects to dashboard if completed
        window.location.href = '/founder/onboarding'
      } else {
        window.location.href = '/admin'
      }
      return
    }

    if (timedOut) {
      window.location.href = '/access-required'
    }
  }, [userId, isLoaded, user, isLoading, timedOut])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-sm text-muted-foreground">Redirecting...</div>
    </div>
  )
}
