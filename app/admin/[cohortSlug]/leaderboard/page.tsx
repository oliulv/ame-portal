'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams, useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Plus } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useMemo } from 'react'

export default function LeaderboardPage() {
  const params = useParams()
  const router = useRouter()
  const cohortSlug = params.cohortSlug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const startups = useQuery(api.startups.list, cohort ? { cohortId: cohort._id } : 'skip')

  // Sort startups alphabetically by name
  const sortedStartups = useMemo(() => {
    if (!startups) return undefined
    return [...startups].sort((a, b) => a.name.localeCompare(b.name))
  }, [startups])

  const isLoading = cohort === undefined || startups === undefined

  // Redirect if cohort not found (returned null)
  if (cohort === null) {
    router.push('/admin/cohorts')
    return null
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!sortedStartups || sortedStartups.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground">
            Track startup progress and performance for {cohort.label}
          </p>
        </div>

        {/* Empty State */}
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No startups enrolled"
          description="There are no startups enrolled in this cohort yet. Invite startups to start tracking their progress on the leaderboard."
          action={
            <Link href={`/admin/${cohortSlug}/startups`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                View Startups
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground">
          Track startup progress and performance for {cohort.label}
        </p>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Startup
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Goals Completion
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Revenue
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Traffic
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Score
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {sortedStartups.map((startup, index) => (
              <tr key={startup._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                  #{index + 1}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {startup.logoUrl && (
                      <Image
                        src={startup.logoUrl}
                        alt={startup.name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full mr-3"
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-foreground">{startup.name}</div>
                      {startup.websiteUrl && (
                        <a
                          href={startup.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          {startup.websiteUrl}
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  <span className="text-xs text-muted-foreground/60 italic">Scoring data loading...</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  <span className="text-xs text-muted-foreground/60 italic">Scoring data loading...</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  <span className="text-xs text-muted-foreground/60 italic">Scoring data loading...</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                  <span className="text-xs text-muted-foreground/60 italic">Scoring data loading...</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-muted p-4 rounded-lg">
        <p className="text-sm text-muted-foreground mb-2">
          <strong className="text-foreground">Scoring Formula:</strong> Leaderboard score combines multiple factors:
        </p>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li>
            <strong>Goal Completion (40%):</strong> Percentage of completed goals
          </li>
          <li>
            <strong>Revenue (30%):</strong> From Stripe integration or manual entry (£1000 = 30
            points, capped)
          </li>
          <li>
            <strong>Traffic (20%):</strong> Sessions from Accelerate ME Tracker (1000 sessions = 20
            points, capped)
          </li>
          <li>
            <strong>Automation Bonus (10%):</strong> Bonus for goals auto-completed via metric
            tracking
          </li>
        </ul>
        <p className="text-sm text-muted-foreground mt-2">
          Detailed scoring will be available once Convex metric queries are implemented.
        </p>
      </div>
    </div>
  )
}
