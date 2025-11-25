import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldX } from 'lucide-react'

interface CohortAccessDeniedProps {
  cohortSlug: string
  cohortName?: string
}

export function CohortAccessDenied({ cohortSlug, cohortName }: CohortAccessDeniedProps) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldX className="h-6 w-6 text-destructive" />
              <div>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>You don't have permission to access this cohort</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You don't have access to manage <strong>{cohortName || cohortSlug}</strong>. Each
              admin is assigned to specific cohorts they can manage.
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
              <li>You can only access cohorts you've been assigned to</li>
              <li>Contact a super admin if you need access to this cohort</li>
              <li>
                You can switch to a cohort you have access to using the sidebar cohort selector
              </li>
            </ul>

            <div className="pt-2 space-y-2">
              <Button asChild className="w-full">
                <Link href="/admin">Go to Admin Dashboard</Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/admin/cohorts">View Available Cohorts</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
