'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { SignUp } from '@clerk/nextjs'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function AdminInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const { userId, isLoaded } = useAuth()
  const acceptAdminInvite = useMutation(api.adminInvitations.accept)

  const rawToken = params.token ?? ''
  let token = rawToken.trim()
  try {
    token = decodeURIComponent(token)
  } catch {
    // If decoding fails, use trimmed token
  }

  const [status, setStatus] = useState<'idle' | 'accepting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Auto-accept when user is authenticated
  useEffect(() => {
    if (!isLoaded || !userId) return
    if (status !== 'idle') return

    const doAccept = async () => {
      setStatus('accepting')
      try {
        await acceptAdminInvite({ token, clerkId: userId })
        setStatus('success')
        // Redirect to admin dashboard
        router.push('/admin')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to accept invitation'
        setErrorMessage(message)
        setStatus('error')
      }
    }
    doAccept()
  }, [isLoaded, userId, token, acceptAdminInvite, status, router])

  // Show accepting state when authenticated
  if (isLoaded && userId) {
    if (status === 'error') {
      // Map common error messages to user-friendly displays
      let title = 'Error Accepting Invitation'
      let description = errorMessage || 'An unexpected error occurred.'

      if (errorMessage?.includes('not found') || errorMessage?.includes('Invitation not found')) {
        title = 'Invalid Admin Invitation'
        description =
          'This admin invitation link is invalid or has expired. Please contact a system administrator if you believe this is a mistake.'
      } else if (errorMessage?.includes('Already accepted')) {
        title = 'Admin Invitation Already Accepted'
        description =
          'This admin invitation has already been accepted. You can sign in with your account to access the admin portal.'
      } else if (errorMessage?.includes('expired') || errorMessage?.includes('Invitation expired')) {
        title = 'Admin Invitation Expired'
        description =
          'This admin invitation link has expired. Please ask a super admin to send you a new invitation.'
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/login" className="text-sm text-primary hover:underline">
                Go to login
              </Link>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Accepting admin invitation...</div>
      </div>
    )
  }

  // Show sign-up form for unauthenticated users
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Accept Admin Invitation</CardTitle>
            <CardDescription>
              You have been invited to join the AccelerateMe internal tool as an admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Create an account or sign in with Clerk to accept this invitation. After you sign up,
              you will be redirected back here to complete the process.
            </p>
          </CardContent>
        </Card>
        <SignUp
          afterSignUpUrl={`/admin-invite/${encodeURIComponent(token)}`}
          forceRedirectUrl={`/admin-invite/${encodeURIComponent(token)}`}
        />
      </div>
    </div>
  )
}
