'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth, useUser, useClerk } from '@clerk/nextjs'
import { SignUp } from '@clerk/nextjs'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function AdminInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const { userId, isLoaded } = useAuth()
  const { user: clerkUser } = useUser()
  const { signOut } = useClerk()

  const rawToken = params.token ?? ''
  let token = rawToken.trim()
  try {
    token = decodeURIComponent(token)
  } catch {
    // If decoding fails, use trimmed token
  }

  const invitation = useQuery(api.adminInvitations.getByToken, { token })
  const acceptAdminInvite = useMutation(api.adminInvitations.accept)

  const [status, setStatus] = useState<'idle' | 'accepting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [emailMismatch, setEmailMismatch] = useState(false)

  // Auto-accept when user is authenticated and invitation is valid
  useEffect(() => {
    if (!isLoaded || !userId) return
    if (invitation === undefined) return // still loading
    if (!invitation) return // invalid
    if (invitation.acceptedAt) return // already accepted
    if (new Date(invitation.expiresAt) < new Date()) return // expired
    if (status !== 'idle') return

    // Check if logged-in user's email matches the invitation email
    const currentEmail = clerkUser?.primaryEmailAddress?.emailAddress
    if (
      currentEmail &&
      invitation.email &&
      currentEmail.toLowerCase() !== invitation.email.toLowerCase()
    ) {
      setEmailMismatch(true)
      return
    }

    const doAccept = async () => {
      setStatus('accepting')
      try {
        await acceptAdminInvite({ token, clerkId: userId })
        setStatus('success')
        router.push('/admin')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to accept invitation'
        setErrorMessage(message)
        setStatus('error')
      }
    }
    doAccept()
  }, [isLoaded, userId, clerkUser, invitation, token, acceptAdminInvite, status, router])

  // Loading state
  if (invitation === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading invitation...</div>
      </div>
    )
  }

  // Invalid invitation
  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invalid Admin Invitation</CardTitle>
            <CardDescription>
              This admin invitation link is invalid or has expired. Please contact a system
              administrator if you believe this is a mistake.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-sm text-primary hover:underline">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Already accepted
  if (invitation.acceptedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Admin Invitation Already Accepted</CardTitle>
            <CardDescription>
              This admin invitation has already been accepted. You can sign in with your account to
              access the admin portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-sm text-primary hover:underline">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Expired
  if (new Date(invitation.expiresAt) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Admin Invitation Expired</CardTitle>
            <CardDescription>
              This admin invitation link has expired. Please ask a super admin to send you a new
              invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-sm text-primary hover:underline">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Email mismatch - logged-in user is not the invited admin
  if (userId && emailMismatch && invitation) {
    const currentEmail = clerkUser?.primaryEmailAddress?.emailAddress
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Wrong Account</CardTitle>
            <CardDescription>
              This invitation was sent to{' '}
              <strong className="text-foreground">{invitation.email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You are currently signed in as{' '}
              <strong className="text-foreground">{currentEmail}</strong>. Please sign out and
              create a new account with the invited email address.
            </p>
            <button
              onClick={() => signOut({ redirectUrl: `/admin-invite/${encodeURIComponent(token)}` })}
              className="inline-flex items-center justify-center bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
            >
              Sign Out
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show accepting/error state when authenticated
  if (isLoaded && userId) {
    if (status === 'error') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Error Accepting Invitation</CardTitle>
              <CardDescription>{errorMessage || 'An unexpected error occurred.'}</CardDescription>
            </CardHeader>
            <CardContent>
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
  const invitedName = invitation.invitedName || ''

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <SignUp
          routing="hash"
          forceRedirectUrl={`/admin-invite/${encodeURIComponent(token)}`}
          initialValues={{
            emailAddress: invitation.email,
            firstName: invitedName.split(' ')[0] || '',
            lastName: invitedName.split(' ').slice(1).join(' ') || '',
          }}
          appearance={{
            elements: {
              rootBox: 'mx-auto w-full',
              card: 'bg-card text-card-foreground border border-border p-0',
              cardBox: 'bg-card text-card-foreground border border-border',
              headerTitle: 'text-foreground font-semibold leading-none tracking-tight text-xl',
              headerSubtitle: 'text-muted-foreground text-sm',
              headerTitleContainer: 'mb-4',
              formFieldInput:
                'flex h-9 w-full border border-input bg-transparent px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              formFieldLabel: 'text-foreground text-sm font-medium leading-none',
              formFieldInputShowPasswordButton: 'text-muted-foreground hover:text-foreground',
              formFieldInputGroup: 'space-y-2',
              formButtonPrimary:
                'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 w-full',
              formButtonReset:
                'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
              socialButtonsBlockButton:
                'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 w-full border border-input',
              socialButtonsBlockButtonText: 'text-sm font-medium',
              socialButtonsBlockButtonArrow: 'hidden',
              dividerLine: 'bg-border',
              dividerText: 'text-muted-foreground text-sm',
              footerActionLink: 'hidden',
              footerAction: 'hidden',
              footer: 'hidden',
              footerPages: 'hidden',
              identityPreviewText: 'text-foreground text-sm',
              identityPreviewEditButton:
                'text-primary hover:text-primary/80 text-sm underline-offset-4 hover:underline',
              otpCodeFieldInput:
                'flex h-9 w-full border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              formResendCodeLink:
                'text-primary hover:text-primary/80 text-sm underline-offset-4 hover:underline',
              alertText: 'text-foreground text-sm',
              formFieldErrorText: 'text-destructive text-sm',
              formFieldSuccessText: 'text-muted-foreground text-sm',
              formFieldWarningText: 'text-muted-foreground text-sm',
              form: 'space-y-4',
              formField: 'space-y-2',
              logoImage: 'hidden',
              logoBox: 'hidden',
            },
            variables: {
              colorPrimary: 'hsl(153 43% 18%)',
              colorBackground: 'hsl(0 0% 100%)',
              colorInputBackground: 'transparent',
              colorInputText: 'hsl(155 15% 8%)',
              colorText: 'hsl(155 15% 8%)',
              colorTextSecondary: 'hsl(150 8% 44%)',
              colorDanger: 'hsl(0 84.2% 60.2%)',
              colorSuccess: 'hsl(153 43% 35%)',
              borderRadius: '0',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
            },
          }}
        />
      </div>
    </div>
  )
}
