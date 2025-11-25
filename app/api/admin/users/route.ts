import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { clerkClient } from '@clerk/nextjs/server'

export interface AdminUserWithDetails {
  id: string
  role: 'super_admin' | 'admin'
  created_at: string
  updated_at: string
  email: string | null
  full_name: string | null
  first_name: string | null
  last_name: string | null
  cohort_ids?: string[]
}

/**
 * GET /api/admin/users
 * Returns admin users (super_admin and admin) with enriched Clerk data
 * 
 * Query parameters:
 * - cohort_id (optional): If provided, returns admins assigned to that cohort + all super_admins
 *                         If not provided, returns all admins (for super_admin global view)
 */
export async function GET(request: Request) {
  await requireSuperAdmin()

  const { searchParams } = new URL(request.url)
  const cohortId = searchParams.get('cohort_id')

  const supabase = await createClient()

  let usersQuery = supabase
    .from('users')
    .select('id, role, email, full_name, created_at, updated_at')
    .in('role', ['super_admin', 'admin'])

  // If cohort_id is provided, filter to admins assigned to that cohort + all super_admins
  if (cohortId) {
    // Get all super_admins (they appear in all cohorts)
    const { data: superAdmins } = await supabase
      .from('users')
      .select('id, role, email, full_name, created_at, updated_at')
      .eq('role', 'super_admin')

    // Get admins assigned to this cohort
    const { data: cohortAdmins } = await supabase
      .from('admin_cohorts')
      .select('user_id, users(id, role, email, full_name, created_at, updated_at)')
      .eq('cohort_id', cohortId)

    // Combine super_admins and cohort admins, removing duplicates
    const adminIds = new Set<string>()
    const allUsers: Array<{
      id: string
      role: 'super_admin' | 'admin'
      email: string | null
      full_name: string | null
      created_at: string
      updated_at: string
    }> = []

    // Add super admins
    if (superAdmins) {
      superAdmins.forEach((admin) => {
        adminIds.add(admin.id)
        allUsers.push(admin)
      })
    }

    // Add cohort admins (excluding super_admins already added)
    if (cohortAdmins) {
      cohortAdmins.forEach((ac) => {
        const userData = ac.users
        if (userData && typeof userData === 'object' && !Array.isArray(userData)) {
          const user = userData as {
            id: string
            role: 'super_admin' | 'admin'
            email: string | null
            full_name: string | null
            created_at: string
            updated_at: string
          }
          if (!adminIds.has(user.id)) {
            adminIds.add(user.id)
            allUsers.push(user)
          }
        }
      })
    }

    // Fetch cohort assignments for all users
    const userIds = Array.from(adminIds)
    const { data: cohortAssignments } = await supabase
      .from('admin_cohorts')
      .select('user_id, cohort_id')
      .in('user_id', userIds)

    // Build cohort_ids map
    const cohortIdsMap = new Map<string, string[]>()
    if (cohortAssignments) {
      cohortAssignments.forEach((ca) => {
        if (!cohortIdsMap.has(ca.user_id)) {
          cohortIdsMap.set(ca.user_id, [])
        }
        cohortIdsMap.get(ca.user_id)!.push(ca.cohort_id)
      })
    }

    // Enrich with Clerk data
    const usersWithDetails: AdminUserWithDetails[] = await Promise.all(
      allUsers.map(async (user) => {
        let email = user.email || null
        let full_name = user.full_name || null
        let first_name: string | null = null
        let last_name: string | null = null

        if ((!email || !full_name) && clerkClient) {
          try {
            const client = await clerkClient()
            const clerkUser = await client.users.getUser(user.id)
            const primaryEmail =
              clerkUser?.emailAddresses?.find(
                (e: { id: string }) => e.id === clerkUser.primaryEmailAddressId,
              )?.emailAddress ?? clerkUser?.emailAddresses?.[0]?.emailAddress

            if (!email && primaryEmail) {
              email = primaryEmail
            }
            if (!full_name) {
              const clerkFullName =
                clerkUser?.firstName && clerkUser?.lastName
                  ? `${clerkUser.firstName} ${clerkUser.lastName}`.trim()
                  : clerkUser?.firstName || clerkUser?.lastName || null
              if (clerkFullName) {
                full_name = clerkFullName
              }
            }
            first_name = clerkUser?.firstName || null
            last_name = clerkUser?.lastName || null
          } catch (err) {
            console.error(`Failed to fetch Clerk data for user ${user.id}:`, err)
          }
        }

        return {
          ...user,
          email,
          full_name,
          first_name,
          last_name,
          cohort_ids: cohortIdsMap.get(user.id) || [],
        }
      }),
    )

    return NextResponse.json(usersWithDetails.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ))
  }

  // No cohort_id provided - return all admins (for super_admin global view)
  const { data: users, error } = await usersQuery.order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  // Fetch cohort assignments for all users
  const userIds = (users || []).map((u) => u.id)
  const { data: cohortAssignments } = await supabase
    .from('admin_cohorts')
    .select('user_id, cohort_id')
    .in('user_id', userIds)

  // Build cohort_ids map
  const cohortIdsMap = new Map<string, string[]>()
  if (cohortAssignments) {
    cohortAssignments.forEach((ca) => {
      if (!cohortIdsMap.has(ca.user_id)) {
        cohortIdsMap.set(ca.user_id, [])
      }
      cohortIdsMap.get(ca.user_id)!.push(ca.cohort_id)
    })
  }

  // Enrich with Clerk data
  // Check if Clerk client is available (but still return database fields if not)

  const usersWithDetails: AdminUserWithDetails[] = await Promise.all(
    (users || []).map(async (user) => {
      // Use database fields first, then fall back to Clerk
      let email = user.email || null
      let full_name = user.full_name || null
      let first_name: string | null = null
      let last_name: string | null = null

      // If database doesn't have email or name, try to fetch from Clerk
      if ((!email || !full_name) && clerkClient) {
        try {
          const client = await clerkClient()
          const clerkUser = await client.users.getUser(user.id)
          const primaryEmail =
            clerkUser?.emailAddresses?.find(
              (e: { id: string }) => e.id === clerkUser.primaryEmailAddressId,
            )?.emailAddress ?? clerkUser?.emailAddresses?.[0]?.emailAddress

          // Only use Clerk data if database doesn't have it
          if (!email && primaryEmail) {
            email = primaryEmail
          }
          if (!full_name) {
            const clerkFullName =
              clerkUser?.firstName && clerkUser?.lastName
                ? `${clerkUser.firstName} ${clerkUser.lastName}`.trim()
                : clerkUser?.firstName || clerkUser?.lastName || null
            if (clerkFullName) {
              full_name = clerkFullName
            }
          }
          first_name = clerkUser?.firstName || null
          last_name = clerkUser?.lastName || null
        } catch (err) {
          // If Clerk lookup fails, just use database fields
          console.error(`Failed to fetch Clerk data for user ${user.id}:`, err)
        }
      }

      return {
        ...user,
        email,
        full_name,
        first_name,
        last_name,
        cohort_ids: cohortIdsMap.get(user.id) || [],
      }
    }),
  )

  return NextResponse.json(usersWithDetails)
}

