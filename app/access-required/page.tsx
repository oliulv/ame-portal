'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { SignOutButton } from '@/components/sign-out-button'

export default function AccessRequiredPage() {
  const { userId, isLoaded } = useAuth()

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    // If somehow hit this page without being authenticated, send to login
    if (!userId) {
      window.location.href = '/login'
    }
  }, [userId, isLoaded])

  // Show loading state while checking auth
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // If not authenticated, the redirect will happen, but show nothing while redirecting
  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Redirecting...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Required</CardTitle>
            <CardDescription>Hey there! You're probably not supposed to see this.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your account is authenticated, but you haven't been invited as a founder or granted
              admin access yet. If you believe you should have access, please contact an
              administrator.
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              <li>You'll need to be invited before you can access the platform.</li>
              <li>
                If you were expecting an invitation email, check with the programme team that it was
                sent to the correct address.
              </li>
            </ul>

            <div className="pt-2">
              <SignOutButton />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
