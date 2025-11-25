import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getCurrentUser } from '@/lib/auth'

export default async function Home() {
  const { userId } = await auth()

  // If not authenticated with Clerk, go to login
  if (!userId) {
    redirect('/login')
  }

  // Try to load role from Supabase, but don't loop if it fails
  const user = await getCurrentUser()

  // If the account is authenticated with Clerk but has not been onboarded into
  // our own database, send them to an access-required page instead of looping
  // between / and /login or /admin.
  if (!user) {
    redirect('/access-required')
  }

  if (user.role === 'founder') {
    redirect('/founder/dashboard')
  }

  // Default for any authenticated user with an app-level role
  redirect('/admin')
}
