'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user = useQuery(api.users.current)
  const profileData = useQuery(api.founderProfile.get)

  // Redirect if not authenticated or not a founder
  useEffect(() => {
    if (user !== undefined && (!user || user.role !== 'founder')) {
      window.location.href = !user ? '/login' : '/access-required'
    }
  }, [user])

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
  if (user === undefined || profileData === undefined) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
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
    <div className="min-h-screen bg-white">
      {/* Page content */}
      <main className="flex-1">{children}</main>
    </div>
  )
}
