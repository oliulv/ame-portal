'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Target, Settings, ExternalLink } from 'lucide-react'

export default function AdminFundingPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const overview = useQuery(
    api.milestones.fundingOverview,
    cohort?._id ? { cohortId: cohort._id } : 'skip'
  )

  const isLoading = cohort === undefined || overview === undefined

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!cohort) {
    return (
      <EmptyState
        icon={<Target className="h-6 w-6" />}
        title="Cohort not found"
        description="The selected cohort could not be found."
      />
    )
  }

  const { startups, totals } = overview ?? {
    startups: [],
    totals: { potential: 0, unlocked: 0, deployed: 0 },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Funding</h1>
          <p className="text-muted-foreground">Milestone-based funding for {cohort.label}</p>
        </div>
        <Link href={`/admin/${cohortSlug}/funding/templates`}>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Milestone Templates
          </Button>
        </Link>
      </div>

      {/* Aggregate cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Potential</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {'\u00A3'}
              {totals.potential.toLocaleString('en-GB')}
            </div>
            <p className="text-xs text-muted-foreground">Sum of all milestone amounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Unlocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {'\u00A3'}
              {totals.unlocked.toLocaleString('en-GB')}
            </div>
            <p className="text-xs text-muted-foreground">Approved milestones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deployed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {'\u00A3'}
              {totals.deployed.toLocaleString('en-GB')}
            </div>
            <p className="text-xs text-muted-foreground">Funds sent to startups</p>
          </CardContent>
        </Card>
      </div>

      {/* Startups table */}
      <Card>
        <CardHeader>
          <CardTitle>Startups</CardTitle>
          <CardDescription>Funding overview per startup</CardDescription>
        </CardHeader>
        <CardContent>
          {startups.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Startup</TableHead>
                  <TableHead className="text-right">Potential</TableHead>
                  <TableHead className="text-right">Unlocked</TableHead>
                  <TableHead className="text-right">Deployed</TableHead>
                  <TableHead className="text-right">Milestones</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {startups.map((startup) => (
                  <TableRow key={startup._id}>
                    <TableCell className="font-medium">{startup.name}</TableCell>
                    <TableCell className="text-right">
                      {'\u00A3'}
                      {startup.potential.toLocaleString('en-GB')}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {'\u00A3'}
                      {startup.unlocked.toLocaleString('en-GB')}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      {'\u00A3'}
                      {startup.deployed.toLocaleString('en-GB')}
                    </TableCell>
                    <TableCell className="text-right">{startup.milestoneCount}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/${cohortSlug}/funding/${startup.slug || startup._id}`}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              noCard
              icon={<Target className="h-6 w-6" />}
              title="No startups"
              description="No startups in this cohort yet."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
