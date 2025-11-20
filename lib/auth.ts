import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type UserRole = 'admin' | 'founder'

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
  
  // If user doesn't exist in Supabase, redirect to login
  // This can happen if webhook didn't fire or failed
  if (!user) {
    redirect('/login')
  }

  // If user doesn't have the required role, redirect to appropriate page
  if (user.role !== requiredRole) {
    // Redirect to their role's dashboard or login
    if (user.role === 'admin') {
      redirect('/admin')
    } else if (user.role === 'founder') {
      redirect('/founder/dashboard')
    } else {
      redirect('/login')
    }
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

  return profiles?.map(p => p.startup_id).filter(Boolean) as string[] || []
}

