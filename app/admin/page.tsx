import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function AdminDashboardEntry() {
  const { getCurrentUser } = await import('@/lib/auth')
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  const supabase = await createClient()
  
  // Get cohorts the admin has access to
  let cohorts
  
  if (user.role === 'super_admin') {
    // Super admins can access all cohorts
    const { data } = await supabase
      .from('cohorts')
      .select('id, name, slug, is_active, year_start, year_end')
      .order('year_start', { ascending: false })
    cohorts = data
  } else {
    // Regular admins can only access cohorts they're assigned to
    const { data: adminCohorts } = await supabase
      .from('admin_cohorts')
      .select('cohort_id, cohorts(id, name, slug, is_active, year_start, year_end)')
      .eq('user_id', user.id)
    
    cohorts = adminCohorts
      ?.map((ac) => {
        const cohort = ac.cohorts
        if (cohort && typeof cohort === 'object' && !Array.isArray(cohort)) {
          return cohort as {
            id: string
            name: string
            slug: string
            is_active: boolean
            year_start: number
            year_end: number
          }
        }
        return null
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => (b.year_start || 0) - (a.year_start || 0))
  }

  // No cohorts configured yet – send to cohorts management
  if (!cohorts || cohorts.length === 0) {
    redirect('/admin/cohorts')
  }

  // Single cohort – keep the existing behaviour and go straight in
  if (cohorts.length === 1) {
    redirect(`/admin/${cohorts[0]!.slug}`)
  }

  // Multiple cohorts – let the admin choose which workspace to enter
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Select a cohort to manage</CardTitle>
          <CardDescription>
            You have access to multiple cohorts. Choose one to enter its admin workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {cohorts.map((cohort) => (
              <Link key={cohort.id} href={`/admin/${cohort.slug}`}>
                <Button
                  variant="outline"
                  className="h-auto w-full flex flex-col items-start gap-1 p-4 text-left"
                >
                  <span className="text-sm font-semibold">
                    {cohort.name || cohort.slug}
                    {cohort.is_active && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Active
                      </span>
                    )}
                  </span>
                  {(cohort.year_start || cohort.year_end) && (
                    <span className="text-xs text-muted-foreground">
                      {cohort.year_start ?? '????'} – {cohort.year_end ?? '????'}
                    </span>
                  )}
                </Button>
              </Link>
            ))}
          </div>
          <div className="mt-6 flex justify-between text-xs text-muted-foreground">
            <span>You can switch cohorts at any time from the sidebar cohort selector.</span>
            <Link href="/admin/cohorts">
              <Button variant="ghost" size="sm" className="px-0 text-xs">
                Manage cohorts
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
