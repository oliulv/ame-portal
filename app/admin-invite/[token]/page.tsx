import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

interface AdminInvitePageProps {
  params: Promise<{ token: string }>
}

export default async function AdminInvitePage({ params }: AdminInvitePageProps) {
  const { token: rawToken } = await params
  const supabase = await createClient()

  const token = rawToken.trim()
  let decodedToken = token

  try {
    decodedToken = decodeURIComponent(token)
  } catch {
    decodedToken = token
  }

  // Look up admin invitation
  let { data: invitation, error } = await supabase
    .from('admin_invitations')
    .select('*')
    .eq('token', token)
    .single()

  if ((error || !invitation) && token !== decodedToken) {
    const retry = await supabase
      .from('admin_invitations')
      .select('*')
      .eq('token', decodedToken)
      .single()
    invitation = retry.data
    error = retry.error
  }

  if (error || !invitation) {
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
          <CardContent className="space-y-4">
            <Link href="/login" className="text-sm text-primary hover:underline">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invitation.accepted_at) {
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
          <CardContent className="space-y-4">
            <Link href="/login" className="text-sm text-primary hover:underline">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (new Date(invitation.expires_at) < new Date()) {
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
          <CardContent className="space-y-4">
            <Link href="/login" className="text-sm text-primary hover:underline">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { userId } = await auth()

  // If the user is already authenticated, promote them to admin (if needed)
  if (userId) {
    // Check if user already exists in our users table
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role, email, full_name')
      .eq('id', userId)
      .single()

    const updateData: {
      role: string
      email?: string
      full_name?: string
      updated_at: string
    } = {
      role: existingUser?.role === 'super_admin' ? 'super_admin' : 'admin',
      updated_at: new Date().toISOString(),
    }

    // Auto-hydrate email and name from invitation if not already set
    if (!existingUser?.email && invitation.email) {
      updateData.email = invitation.email
    }
    if (!existingUser?.full_name && invitation.invited_name) {
      updateData.full_name = invitation.invited_name
    }

    if (!existingUser) {
      await supabase.from('users').insert({
        id: userId,
        role: 'admin',
        email: invitation.email || null,
        full_name: invitation.invited_name || null,
      })
    } else {
      // Update role and profile fields if needed
      await supabase.from('users').update(updateData).eq('id', userId)
    }

    // If invitation has a cohort_id, assign admin to that cohort
    if (invitation.cohort_id) {
      // Check if assignment already exists (shouldn't, but be safe)
      const { data: existingAssignment } = await supabase
        .from('admin_cohorts')
        .select('id')
        .eq('user_id', userId)
        .eq('cohort_id', invitation.cohort_id)
        .single()

      if (!existingAssignment) {
        await supabase.from('admin_cohorts').insert({
          user_id: userId,
          cohort_id: invitation.cohort_id,
        })
      }
    }

    // Mark invitation as accepted
    await supabase
      .from('admin_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    // If invitation has a cohort_id, redirect to that cohort's admin page
    if (invitation.cohort_id) {
      const { data: cohort } = await supabase
        .from('cohorts')
        .select('slug')
        .eq('id', invitation.cohort_id)
        .single()
      
      if (cohort?.slug) {
        redirect(`/admin/${cohort.slug}`)
      }
    }

    redirect('/admin')
  }

  const invitedName = invitation.invited_name || 'there'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Accept Admin Invitation</CardTitle>
            <CardDescription>
              {`Hi ${invitedName}, you've been invited to join the AccelerateMe internal tool as an admin.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Create an account or sign in with Clerk to accept this invitation. After you sign up,
              you'll be redirected back here to complete the process.
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


