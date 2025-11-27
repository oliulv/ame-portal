import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole as DbUserRole } from '@/lib/types'

export type UserRole = DbUserRole

export interface AppUser {
  id: string
  role: UserRole
  clerkUserId: string
}

/**
 * Get the current authenticated user from Clerk and their role from Supabase
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const { userId: clerkUserId } = await auth()

  if (!clerkUserId) {
    return null
  }

  const supabase = await createClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', clerkUserId)
    .single()

  if (error || !user) {
    // In non-production environments, optionally auto-provision dev users
    // based on DEV_AUTO_PROMOTE_EMAILS / DEV_AUTO_SUPER_ADMIN_EMAIL.
    if (process.env.NODE_ENV !== 'production') {
      const devUser = await maybeAutoProvisionDevUser(clerkUserId)
      if (devUser) {
        return devUser
      }
    }
    return null
  }

  return {
    id: user.id,
    role: user.role as UserRole,
    clerkUserId,
  }
}

/**
 * Ensure the current user has a specific role
 */
export async function requireRole(requiredRole: UserRole): Promise<AppUser> {
  const { userId: clerkUserId } = await auth()

  // If not authenticated with Clerk, redirect to login
  if (!clerkUserId) {
    redirect('/login')
  }

  const user = await getCurrentUser()

  // If user doesn't exist in Supabase, send them to the access-required page
  // so we don't get stuck in a /login ↔ /admin redirect loop.
  if (!user) {
    redirect('/access-required')
  }

  // If user doesn't have the required role, redirect to appropriate page.
  //
  // Semantics:
  // - super_admin satisfies requireAdmin (can do everything admin can)
  // - admin does NOT satisfy requireSuperAdmin
  // - founder only satisfies requireFounder
  const hasRequiredRole =
    requiredRole === 'admin'
      ? user.role === 'admin' || user.role === 'super_admin'
      : user.role === requiredRole

  if (!hasRequiredRole) {
    let redirectPath = '/access-required'
    if (user.role === 'super_admin' || user.role === 'admin') {
      redirectPath = '/admin'
    } else if (user.role === 'founder') {
      redirectPath = '/founder/dashboard'
    }
    redirect(redirectPath)
  }

  return user
}

/**
 * Ensure the current user is an admin
 */
export async function requireAdmin(): Promise<AppUser> {
  return requireRole('admin')
}

/**
 * Ensure the current user is a super admin
 */
export async function requireSuperAdmin(): Promise<AppUser> {
  return requireRole('super_admin')
}

/**
 * Ensure the current user is a founder
 */
export async function requireFounder(): Promise<AppUser> {
  return requireRole('founder')
}

/**
 * Get the current user's startup ID(s) if they are a founder
 */
export async function getFounderStartupIds(): Promise<string[]> {
  const user = await getCurrentUser()

  if (!user || user.role !== 'founder') {
    return []
  }

  const supabase = await createClient()
  const { data: profiles } = await supabase
    .from('founder_profiles')
    .select('startup_id')
    .eq('user_id', user.id)

  return (profiles?.map((p) => p.startup_id).filter(Boolean) as string[]) || []
}

/**
 * Dev-only helper: automatically create a users row for whitelisted emails.
 *
 * This makes it easy for local developers to get admin/super_admin access
 * without manually editing the database. Disabled in production.
 */
async function maybeAutoProvisionDevUser(clerkUserId: string): Promise<AppUser | null> {
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  const rawList = process.env.DEV_AUTO_PROMOTE_EMAILS
  if (!rawList) {
    return null
  }

  const allowedEmails = rawList
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (allowedEmails.length === 0) {
    return null
  }

  const superAdminEmail = process.env.DEV_AUTO_SUPER_ADMIN_EMAIL?.toLowerCase()

  try {
    // clerkClient is a function that returns the client instance
    if (!clerkClient) {
      return null
    }
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(clerkUserId)
    const primaryEmail =
      clerkUser?.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress ?? clerkUser?.emailAddresses?.[0]?.emailAddress

    const normalizedEmail = primaryEmail?.toLowerCase()
    if (!normalizedEmail || !allowedEmails.includes(normalizedEmail)) {
      return null
    }

    const role: UserRole =
      superAdminEmail && normalizedEmail === superAdminEmail ? 'super_admin' : 'admin'

    const supabase = createAdminClient()
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        id: clerkUserId,
        role: role as DbUserRole,
      })
      .select('id, role')
      .single()

    if (error || !newUser) {
      console.error('Dev auto-provision failed for user', clerkUserId, error)
      return null
    }

    return {
      id: newUser.id,
      role: newUser.role as UserRole,
      clerkUserId,
    }
  } catch (err) {
    console.error('Error during dev auto-provision for user', clerkUserId, err)
    return null
  }
}
