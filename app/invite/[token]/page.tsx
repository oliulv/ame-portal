import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token: rawToken } = await params
  const supabase = await createClient()

  // Trim and normalize the token (Next.js should decode URL params automatically)
  const token = rawToken.trim()
  
  // Try URL decoding in case email client encoded it (safe fallback)
  let decodedToken = token
  try {
    decodedToken = decodeURIComponent(token)
  } catch {
    // If decoding fails, use original token
    decodedToken = token
  }

  // Check if invitation is valid - try exact match first
  // Note: cohorts must be accessed through startups, not directly
  let { data: invitation, error } = await supabase
    .from('invitations')
    .select('*, startups(id, name, cohort_id, cohorts(id, name))')
    .eq('token', token)
    .single()

  // If first query failed and tokens are different, try decoded version
  if ((error || !invitation) && token !== decodedToken) {
    const retryResult = await supabase
      .from('invitations')
      .select('*, startups(id, name, cohort_id, cohorts(id, name))')
      .eq('token', decodedToken)
      .single()
    
    invitation = retryResult.data
    error = retryResult.error
  }

  // Final fallback: try case-insensitive match (in case of database collation issues)
  if (error || !invitation) {
    const fallbackResult = await supabase
      .from('invitations')
      .select('*, startups(id, name, cohort_id, cohorts(id, name))')
      .ilike('token', token)
      .single()
    
    // Only use fallback if it found a result
    if (fallbackResult.data) {
      invitation = fallbackResult.data
      error = null
    }
  }

  if (error || !invitation) {
    // Log error for debugging
    console.error('Invitation lookup error:', {
      error: error?.message || error,
      token,
      tokenLength: token.length,
      decodedToken,
      decodedTokenLength: decodedToken.length,
      rawToken,
      rawTokenLength: rawToken.length,
    })

    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="bg-card text-card-foreground p-8 rounded-lg shadow-md border border-border max-w-md mx-4">
            <h1 className="text-2xl font-bold mb-4 text-foreground">Invalid Invitation</h1>
            <p className="text-muted-foreground mb-4">This invitation link is invalid or has expired.</p>
            <Link href="/login" className="text-primary hover:text-primary/80 underline">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Check if already accepted
  if (invitation.accepted_at) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="bg-card text-card-foreground p-8 rounded-lg shadow-md border border-border max-w-md mx-4">
            <h1 className="text-2xl font-bold mb-4 text-foreground">Invitation Already Accepted</h1>
            <p className="text-muted-foreground mb-4">This invitation has already been accepted.</p>
            <Link href="/login" className="text-primary hover:text-primary/80 underline">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Check if expired
  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="bg-card text-card-foreground p-8 rounded-lg shadow-md border border-border max-w-md mx-4">
            <h1 className="text-2xl font-bold mb-4 text-foreground">Invitation Expired</h1>
            <p className="text-muted-foreground mb-4">This invitation link has expired.</p>
            <Link href="/login" className="text-primary hover:text-primary/80 underline">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { userId } = await auth()

  // If user is already authenticated, process the invitation
  if (userId) {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    // Create user record if doesn't exist
    if (!existingUser) {
      await supabase.from('users').insert({
        id: userId,
        role: 'founder',
      })
    }

    // Create founder profile
    const { data: existingProfile } = await supabase
      .from('founder_profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('startup_id', invitation.startup_id)
      .single()

    if (!existingProfile) {
      await supabase.from('founder_profiles').insert({
        user_id: userId,
        startup_id: invitation.startup_id,
        full_name: invitation.full_name,
        personal_email: invitation.email,
        onboarding_status: 'pending',
      })
    }

    // Mark invitation as accepted
    await supabase
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    redirect('/founder/onboarding')
  }

  // Show sign-up form
  // Cohorts are nested inside startups in the query result
  const cohortName = invitation.startups?.cohorts?.name || 'the cohort'
  const startupName = invitation.startups?.name || 'your startup'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="bg-card text-card-foreground p-8 rounded-lg shadow-md mb-4 border border-border">
          <h1 className="text-2xl font-bold mb-2">Welcome to AccelerateMe!</h1>
          <p className="text-muted-foreground mb-4">
            You've been invited to join <strong className="text-foreground">{cohortName}</strong> as a founder of <strong className="text-foreground">{startupName}</strong>.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Please create an account to accept your invitation.
          </p>
        </div>
        <SignUp
          afterSignUpUrl={`/invite/${token}`}
          forceRedirectUrl={`/invite/${token}`}
          appearance={{
            elements: {
              // Root container
              rootBox: 'mx-auto w-full',
              
              // Main card container - match your Card component
              card: 'bg-card text-card-foreground rounded-lg border border-border shadow-sm p-0',
              cardBox: 'bg-card text-card-foreground rounded-lg border border-border shadow-sm',
              
              // Header styling
              headerTitle: 'text-foreground font-semibold leading-none tracking-tight text-xl',
              headerSubtitle: 'text-muted-foreground text-sm',
              headerTitleContainer: 'mb-4',
              
              // Form fields - match your Input component
              formFieldInput: 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              formFieldLabel: 'text-foreground text-sm font-medium leading-none',
              formFieldInputShowPasswordButton: 'text-muted-foreground hover:text-foreground',
              formFieldInputGroup: 'space-y-2',
              
              // Buttons - match your Button component
              formButtonPrimary: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 w-full',
              formButtonReset: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
              
              // Social buttons - match your secondary button style
              socialButtonsBlockButton: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 w-full border border-input',
              socialButtonsBlockButtonText: 'text-sm font-medium',
              socialButtonsBlockButtonArrow: 'hidden',
              
              // Divider
              dividerLine: 'bg-border',
              dividerText: 'text-muted-foreground text-sm',
              
              // Footer - hide sign-in link
              footerActionLink: 'hidden',
              footerAction: 'hidden',
              footer: 'hidden',
              footerPages: 'hidden',
              
              // Identity preview
              identityPreviewText: 'text-foreground text-sm',
              identityPreviewEditButton: 'text-primary hover:text-primary/80 text-sm underline-offset-4 hover:underline',
              
              // OTP/Verification
              otpCodeFieldInput: 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              formResendCodeLink: 'text-primary hover:text-primary/80 text-sm underline-offset-4 hover:underline',
              
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
              colorPrimary: 'hsl(221.2 83.2% 53.3%)',
              colorBackground: 'hsl(0 0% 100%)',
              colorInputBackground: 'transparent',
              colorInputText: 'hsl(222.2 84% 4.9%)',
              colorText: 'hsl(222.2 84% 4.9%)',
              colorTextSecondary: 'hsl(215.4 16.3% 46.9%)',
              colorDanger: 'hsl(0 84.2% 60.2%)',
              colorSuccess: 'hsl(160 84.1% 39.4%)',
              borderRadius: '0.5rem',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
            },
          }}
        />
      </div>
    </div>
  )
}

