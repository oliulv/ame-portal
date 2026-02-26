'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user = useQuery(api.users.current)
  const profileData = useQuery(api.founderProfile.get)

  const [waitCount, setWaitCount] = useState(0)

  // Redirect if not authenticated or not a founder
  useEffect(() => {
    if (user === undefined) return

    if (user && user.role !== 'founder') {
      window.location.href = '/access-required'
      return
    }

    if (!user) {
      if (waitCount < 10) {
        const timer = setTimeout(() => setWaitCount((c) => c + 1), 500)
        return () => clearTimeout(timer)
      }
      window.location.href = '/login'
    }
  }, [user, waitCount])

  // If onboarding is already completed, redirect to dashboard
  useEffect(() => {
    if (
      profileData?.founderProfile &&
      profileData.founderProfile.onboardingStatus === 'completed'
    ) {
      router.push('/founder/dashboard')
    }
  }, [profileData, router])

  // Loading state while checking auth and onboarding status
  if (user === undefined || (!user && waitCount < 10) || profileData === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Not authenticated or not a founder
  if (!user || user.role !== 'founder') {
    return null
  }

  // Onboarding already completed - show nothing while redirecting
  if (profileData?.founderProfile?.onboardingStatus === 'completed') {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page content */}
      <main className="flex-1">{children}</main>
    </div>
  )
}
