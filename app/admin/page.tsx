'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AdminDashboardEntry() {
  const router = useRouter()
  const cohorts = useQuery(api.cohorts.list)

  useEffect(() => {
    if (cohorts === undefined) return

    if (!cohorts || cohorts.length === 0) {
      router.replace('/admin/cohorts')
      return
    }

    if (cohorts.length === 1) {
      router.replace(`/admin/${cohorts[0]!.slug}`)
    }
  }, [cohorts, router])

  if (cohorts === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!cohorts || cohorts.length <= 1) {
    return null
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
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
              <Link key={cohort._id} href={`/admin/${cohort.slug}`}>
                <Button
                  variant="outline"
                  className="h-auto w-full flex flex-col items-start gap-1 p-4 text-left"
                >
                  <span className="text-sm font-semibold">
                    {cohort.name || cohort.slug}
                    {cohort.isActive && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Active
                      </span>
                    )}
                  </span>
                  {(cohort.yearStart || cohort.yearEnd) && (
                    <span className="text-xs text-muted-foreground">
                      {cohort.yearStart ?? '????'} – {cohort.yearEnd ?? '????'}
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
