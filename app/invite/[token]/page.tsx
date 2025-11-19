import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params
  const supabase = await createClient()

  // Check if invitation is valid
  const { data: invitation, error } = await supabase
    .from('invitations')
    .select('*, startups(id, name, cohort_id), cohorts(id, name)')
    .eq('token', token)
    .single()

  if (error || !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Invitation</h1>
          <p className="text-gray-600 mb-4">This invitation link is invalid or has expired.</p>
          <Link href="/login" className="text-blue-600 hover:underline">
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  // Check if already accepted
  if (invitation.accepted_at) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invitation Already Accepted</h1>
          <p className="text-gray-600 mb-4">This invitation has already been accepted.</p>
          <Link href="/login" className="text-blue-600 hover:underline">
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  // Check if expired
  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invitation Expired</h1>
          <p className="text-gray-600 mb-4">This invitation link has expired.</p>
          <Link href="/login" className="text-blue-600 hover:underline">
            Go to Login
          </Link>
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
  const cohortName = invitation.cohorts?.name || 'the cohort'
  const startupName = invitation.startups?.name || 'your startup'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md mb-4">
          <h1 className="text-2xl font-bold mb-2">Welcome to AccelerateMe!</h1>
          <p className="text-gray-600 mb-4">
            You've been invited to join <strong>{cohortName}</strong> as a founder of <strong>{startupName}</strong>.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Please create an account to accept your invitation.
          </p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'mx-auto',
            },
          }}
        />
      </div>
    </div>
  )
}

