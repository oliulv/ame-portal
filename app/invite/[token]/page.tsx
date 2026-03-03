'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth, useUser, useClerk } from '@clerk/nextjs'
import { SignUp } from '@clerk/nextjs'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'

export default function InvitePage() {
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

  const invitation = useQuery(api.invitations.getByToken, { token })
  const acceptInvite = useMutation(api.invitations.accept)

  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const [hasAccepted, setHasAccepted] = useState(false)
  const [emailMismatch, setEmailMismatch] = useState(false)

  // Check email match and auto-accept when user is authenticated and invitation is valid
  useEffect(() => {
    if (!isLoaded || !userId) return
    if (invitation === undefined) return // still loading
    if (!invitation) return // invalid
    if (invitation.acceptedAt) return // already accepted
    if (new Date(invitation.expiresAt) < new Date()) return // expired
    if (isAccepting || hasAccepted) return

    // Check if logged-in user's email matches the invitation email
    const currentEmail = clerkUser?.primaryEmailAddress?.emailAddress
    if (currentEmail && currentEmail.toLowerCase() !== invitation.email.toLowerCase()) {
      setEmailMismatch(true)
      return
    }

    const doAccept = async () => {
      setIsAccepting(true)
      try {
        await acceptInvite({ token, clerkId: userId })
        setHasAccepted(true)
        router.push('/founder/onboarding')
      } catch (err) {
        setAcceptError(err instanceof Error ? err.message : 'Failed to accept invitation')
        setIsAccepting(false)
      }
    }
    doAccept()
  }, [
    isLoaded,
    userId,
    clerkUser,
    invitation,
    token,
    acceptInvite,
    isAccepting,
    hasAccepted,
    router,
  ])

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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="bg-card text-card-foreground p-8  border border-border max-w-md mx-4">
            <h1 className="text-2xl font-bold font-display mb-4 text-foreground">
              Invalid Invitation
            </h1>
            <p className="text-muted-foreground mb-4">
              This invitation link is invalid or has expired.
            </p>
            <Link href="/login" className="text-primary hover:text-primary/80 underline">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Already accepted
  if (invitation.acceptedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="bg-card text-card-foreground p-8  border border-border max-w-md mx-4">
            <h1 className="text-2xl font-bold font-display mb-4 text-foreground">
              Invitation Already Accepted
            </h1>
            <p className="text-muted-foreground mb-4">This invitation has already been accepted.</p>
            <Link href="/login" className="text-primary hover:text-primary/80 underline">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Expired
  if (new Date(invitation.expiresAt) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="bg-card text-card-foreground p-8  border border-border max-w-md mx-4">
            <h1 className="text-2xl font-bold font-display mb-4 text-foreground">
              Invitation Expired
            </h1>
            <p className="text-muted-foreground mb-4">This invitation link has expired.</p>
            <Link href="/login" className="text-primary hover:text-primary/80 underline">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Email mismatch - logged-in user is not the invited founder
  if (userId && emailMismatch && invitation) {
    const currentEmail = clerkUser?.primaryEmailAddress?.emailAddress
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="bg-card text-card-foreground p-8  border border-border max-w-md mx-4">
            <h1 className="text-2xl font-bold font-display mb-4 text-foreground">Wrong Account</h1>
            <p className="text-muted-foreground mb-2">
              This invitation was sent to{' '}
              <strong className="text-foreground">{invitation.email}</strong>.
            </p>
            <p className="text-muted-foreground mb-6">
              You are currently signed in as{' '}
              <strong className="text-foreground">{currentEmail}</strong>. Please sign out and
              create a new account with the invited email address.
            </p>
            <button
              onClick={() => signOut({ redirectUrl: `/invite/${encodeURIComponent(token)}` })}
              className="inline-flex items-center justify-center bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // User is authenticated - show accepting state
  if (userId) {
    if (acceptError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center">
            <div className="bg-card text-card-foreground p-8  border border-border max-w-md mx-4">
              <h1 className="text-2xl font-bold font-display mb-4 text-foreground">Error</h1>
              <p className="text-muted-foreground mb-4">{acceptError}</p>
              <Link href="/login" className="text-primary hover:text-primary/80 underline">
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Accepting invitation...</div>
      </div>
    )
  }

  // Show sign-up form for unauthenticated users
  const founderName = invitation.fullName || 'Founder'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <SignUp
          routing="hash"
          afterSignUpUrl={`/invite/${encodeURIComponent(token)}`}
          forceRedirectUrl={`/invite/${encodeURIComponent(token)}`}
          initialValues={{
            emailAddress: invitation.email,
            firstName: invitation.fullName?.split(' ')[0] || '',
            lastName: invitation.fullName?.split(' ').slice(1).join(' ') || '',
          }}
          appearance={{
            elements: {
              // Root container
              rootBox: 'mx-auto w-full',

              // Main card container
              card: 'bg-card text-card-foreground border border-border p-0',
              cardBox: 'bg-card text-card-foreground border border-border',

              // Header styling
              headerTitle: 'text-foreground font-semibold leading-none tracking-tight text-xl',
              headerSubtitle: 'text-muted-foreground text-sm',
              headerTitleContainer: 'mb-4',

              // Form fields
              formFieldInput:
                'flex h-9 w-full border border-input bg-transparent px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              formFieldLabel: 'text-foreground text-sm font-medium leading-none',
              formFieldInputShowPasswordButton: 'text-muted-foreground hover:text-foreground',
              formFieldInputGroup: 'space-y-2',

              // Buttons
              formButtonPrimary:
                'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 w-full',
              formButtonReset:
                'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',

              // Social buttons
              socialButtonsBlockButton:
                'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 w-full border border-input',
              socialButtonsBlockButtonText: 'text-sm font-medium',
              socialButtonsBlockButtonArrow: 'hidden',

              // Divider
              dividerLine: 'bg-border',
              dividerText: 'text-muted-foreground text-sm',

              // Footer - hide sign-in link (founders must use invite)
              footerActionLink: 'hidden',
              footerAction: 'hidden',
              footer: 'hidden',
              footerPages: 'hidden',

              // Identity preview
              identityPreviewText: 'text-foreground text-sm',
              identityPreviewEditButton:
                'text-primary hover:text-primary/80 text-sm underline-offset-4 hover:underline',

              // OTP/Verification
              otpCodeFieldInput:
                'flex h-9 w-full border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              formResendCodeLink:
                'text-primary hover:text-primary/80 text-sm underline-offset-4 hover:underline',

              // Alerts and messages
              alertText: 'text-foreground text-sm',
              formFieldErrorText: 'text-destructive text-sm',
              formFieldSuccessText: 'text-muted-foreground text-sm',
              formFieldWarningText: 'text-muted-foreground text-sm',

              // Form container spacing
              form: 'space-y-4',
              formField: 'space-y-2',

              // Remove Clerk branding
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
