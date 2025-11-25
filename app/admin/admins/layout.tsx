import { requireSuperAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function getDefaultCohortSlug(): Promise<string | null> {
  const supabase = await createClient()
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id, slug, is_active')
    .order('year_start', { ascending: false })

  if (!cohorts || cohorts.length === 0) {
    return null
  }

  // Prefer active cohort, otherwise use first cohort
  const activeCohort = cohorts.find((c) => c.is_active)

  return activeCohort?.slug || cohorts[0]?.slug || null
}

export default async function AdminsLayout({ children }: { children: React.ReactNode }) {
  // This ensures only super_admin can access this route
  await requireSuperAdmin()
  
  // Redirect to cohort-scoped route
  const cohortSlug = await getDefaultCohortSlug()
  if (cohortSlug) {
    redirect(`/admin/${cohortSlug}/admins`)
  }
  
  // If no cohorts exist, redirect to cohorts page
  redirect('/admin/cohorts')
}

