'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams, useRouter } from 'next/navigation'
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
import { Target, Settings } from 'lucide-react'

export default function AdminFundingPage() {
  const params = useParams()
  const router = useRouter()
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

  const {
    startups,
    totals,
    cohort: cohortFunding,
  } = overview ?? {
    startups: [],
    totals: { potential: 0, unlocked: 0, deployed: 0, available: 0 },
    cohort: { fundingBudget: null, baseFunding: null, startupCount: 0 },
  }

  const budget = cohortFunding.fundingBudget
  const baseFunding = cohortFunding.baseFunding
  const budgetRemaining = budget != null ? budget - totals.potential : null

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

      {/* Cohort budget overview */}
      {budget != null && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium">Cohort Budget</p>
                <p className="text-2xl font-bold">
                  {'\u00A3'}
                  {budget.toLocaleString('en-GB')}
                </p>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Allocated:</span>
                  <span className="font-medium">
                    {'\u00A3'}
                    {totals.potential.toLocaleString('en-GB')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Remaining:</span>
                  <span
                    className={`font-medium ${budgetRemaining != null && budgetRemaining < 0 ? 'text-red-600' : 'text-green-600'}`}
                  >
                    {'\u00A3'}
                    {(budgetRemaining ?? 0).toLocaleString('en-GB')}
                  </span>
                </div>
              </div>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-foreground/80 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totals.potential / budget) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {Math.round((totals.potential / budget) * 100)}% allocated across{' '}
                {cohortFunding.startupCount} startups
              </p>
              {baseFunding != null && (
                <p className="text-xs text-muted-foreground">
                  Base funding: {'\u00A3'}
                  {baseFunding.toLocaleString('en-GB')}/startup
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aggregate cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Total Unlocked</p>
            <p className="text-2xl font-bold mt-1">
              {'\u00A3'}
              {totals.unlocked.toLocaleString('en-GB')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              of {'\u00A3'}
              {totals.potential.toLocaleString('en-GB')} potential
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Total Deployed</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {'\u00A3'}
              {totals.deployed.toLocaleString('en-GB')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Total Available</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {'\u00A3'}
              {totals.available.toLocaleString('en-GB')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      {totals.unlocked > 0 && (
        <div className="h-3 rounded-full bg-muted overflow-hidden flex">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{ width: `${(totals.deployed / totals.unlocked) * 100}%` }}
          />
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${(totals.available / totals.unlocked) * 100}%` }}
          />
        </div>
      )}

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
                  {baseFunding != null && <TableHead className="text-right">Base</TableHead>}
                  <TableHead className="text-right">Unlocked</TableHead>
                  <TableHead className="text-right">Deployed</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Milestones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {startups.map((startup) => (
                  <TableRow
                    key={startup._id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() =>
                      router.push(`/admin/${cohortSlug}/funding/${startup.slug || startup._id}`)
                    }
                  >
                    <TableCell className="font-medium">{startup.name}</TableCell>
                    {baseFunding != null && (
                      <TableCell className="text-right text-muted-foreground">
                        {'\u00A3'}
                        {baseFunding.toLocaleString('en-GB')}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-medium">
                      {'\u00A3'}
                      {startup.unlocked.toLocaleString('en-GB')}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      {'\u00A3'}
                      {startup.deployed.toLocaleString('en-GB')}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {'\u00A3'}
                      {startup.available.toLocaleString('en-GB')}
                    </TableCell>
                    <TableCell className="text-right">{startup.milestoneCount}</TableCell>
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
