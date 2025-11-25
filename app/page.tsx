'use client'

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'

export default function Home() {
  const { userId, isLoaded } = useAuth()

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    // If not authenticated with Clerk, go to login
    if (!userId) {
      window.location.href = '/login'
      return
    }

    // Fetch user data and redirect based on role
    async function checkUserAndRedirect() {
      try {
        const response = await fetch('/api/user/current')
        
        if (!response.ok) {
          // If user doesn't exist in Supabase, send them to access-required page
          window.location.href = '/access-required'
          return
        }

        const user = await response.json()

        if (!user) {
          window.location.href = '/access-required'
          return
        }

        if (user.role === 'founder') {
          window.location.href = '/founder/dashboard'
          return
        }

        // Default for any authenticated user with an app-level role
        window.location.href = '/admin'
      } catch (error) {
        // If there's a real error getting the user, send to access-required page
        console.error('Error getting user in home page:', error)
        window.location.href = '/access-required'
      }
    }

    checkUserAndRedirect()
  }, [userId, isLoaded])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-sm text-muted-foreground">Redirecting...</div>
    </div>
  )
}
