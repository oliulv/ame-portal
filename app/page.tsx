'use client'

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useWaitForUser } from '@/hooks/useWaitForUser'

export default function Home() {
  const { userId, isLoaded } = useAuth()
  const { user, isLoading, timedOut } = useWaitForUser()

  useEffect(() => {
    if (!isLoaded) return

    if (!userId) {
      window.location.href = '/login'
      return
    }

    if (isLoading) return

    if (user) {
      if (user.role === 'founder') {
        window.location.href = '/founder/dashboard'
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
