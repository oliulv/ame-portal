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
  const startupCount = cohortFunding.startupCount
  const budgetRemaining = budget != null ? budget - totals.potential : null
  const avgUnlocked = startupCount > 0 ? totals.unlocked / startupCount : 0
  const avgDeployed = startupCount > 0 ? totals.deployed / startupCount : 0
  const avgAvailable = startupCount > 0 ? totals.available / startupCount : 0

  const baseCommitmentTotal = baseFunding != null ? baseFunding * startupCount : null
  const baseUnlockedTotal =
    baseFunding != null
      ? startups.reduce((sum, startup) => sum + Math.min(startup.unlocked, baseFunding), 0)
      : null
  const baseDeployedTotal =
    baseFunding != null
      ? startups.reduce((sum, startup) => sum + Math.min(startup.deployed, baseFunding), 0)
      : null
  const baseAvailableTotal =
    baseUnlockedTotal != null && baseDeployedTotal != null
      ? Math.max(0, baseUnlockedTotal - baseDeployedTotal)
      : null

  const topUpBudgetTotal =
    budget != null && baseCommitmentTotal != null ? budget - baseCommitmentTotal : null
  const topUpPotentialAllocated =
    baseFunding != null
      ? startups.reduce((sum, startup) => sum + Math.max(0, startup.potential - baseFunding), 0)
      : null
  const topUpBudgetRemaining =
    topUpBudgetTotal != null && topUpPotentialAllocated != null
      ? topUpBudgetTotal - topUpPotentialAllocated
      : null

  const topUpUnlockedTotal =
    baseUnlockedTotal != null ? Math.max(0, totals.unlocked - baseUnlockedTotal) : null
  const topUpDeployedTotal =
    baseDeployedTotal != null ? Math.max(0, totals.deployed - baseDeployedTotal) : null
  const topUpAvailableTotal =
    topUpUnlockedTotal != null && topUpDeployedTotal != null
      ? Math.max(0, topUpUnlockedTotal - topUpDeployedTotal)
      : null

  const potentialPct = budget != null && budget > 0 ? (totals.potential / budget) * 100 : 0
  const unlockedPct = totals.potential > 0 ? (totals.unlocked / totals.potential) * 100 : 0
  const deployedPct = totals.potential > 0 ? (totals.deployed / totals.potential) * 100 : 0

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

      {budget != null && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Cohort budget usage</p>
              <p className="text-xs text-muted-foreground">
                £{totals.potential.toLocaleString('en-GB')} allocated of £
                {budget.toLocaleString('en-GB')}
              </p>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 bg-emerald-500/25"
                style={{ width: `${Math.min(100, unlockedPct)}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-blue-600"
                style={{ width: `${Math.min(100, deployedPct)}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Deployed £{totals.deployed.toLocaleString('en-GB')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500/40" />
                Available £{totals.available.toLocaleString('en-GB')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                Potential £{totals.potential.toLocaleString('en-GB')}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {Math.round(Math.max(0, potentialPct))}% of total cohort budget is allocated.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Unlocked</p>
            <p className="mt-1 text-2xl font-bold">£{totals.unlocked.toLocaleString('en-GB')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Across {startupCount} startups · avg £{avgUnlocked.toLocaleString('en-GB')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Deployed</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">
              £{totals.deployed.toLocaleString('en-GB')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Across {startupCount} startups · avg £{avgDeployed.toLocaleString('en-GB')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Available</p>
            <p className="mt-1 text-2xl font-bold text-green-600">
              £{totals.available.toLocaleString('en-GB')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Across {startupCount} startups · avg £{avgAvailable.toLocaleString('en-GB')}
            </p>
          </CardContent>
        </Card>
      </div>

      {(baseFunding != null || budget != null) && (
        <Card>
          <CardHeader>
            <CardTitle>Base vs Top-Up Overview</CardTitle>
            <CardDescription>
              Base funding is £{(baseFunding ?? 0).toLocaleString('en-GB')} per startup. Top-up is
              anything above that.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm font-medium">Base Funding Layer</p>
              <p className="text-xs text-muted-foreground">
                Commitment: £{(baseCommitmentTotal ?? 0).toLocaleString('en-GB')} ({startupCount} x
                £{(baseFunding ?? 0).toLocaleString('en-GB')})
              </p>
              <p className="text-sm">
                Unlocked: £{(baseUnlockedTotal ?? 0).toLocaleString('en-GB')}
              </p>
              <p className="text-sm text-blue-600">
                Deployed: £{(baseDeployedTotal ?? 0).toLocaleString('en-GB')}
              </p>
              <p className="text-sm text-green-600">
                Available: £{(baseAvailableTotal ?? 0).toLocaleString('en-GB')}
              </p>
            </div>
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm font-medium">Top-Up Layer</p>
              {topUpBudgetTotal != null && (
                <p className="text-xs text-muted-foreground">
                  Pool: £{topUpBudgetTotal.toLocaleString('en-GB')} · Remaining £
                  {(topUpBudgetRemaining ?? 0).toLocaleString('en-GB')}
                </p>
              )}
              <p className="text-sm">
                Allocated above base: £{(topUpPotentialAllocated ?? 0).toLocaleString('en-GB')}
              </p>
              <p className="text-sm">
                Unlocked: £{(topUpUnlockedTotal ?? 0).toLocaleString('en-GB')}
              </p>
              <p className="text-sm text-blue-600">
                Deployed: £{(topUpDeployedTotal ?? 0).toLocaleString('en-GB')}
              </p>
              <p className="text-sm text-green-600">
                Available: £{(topUpAvailableTotal ?? 0).toLocaleString('en-GB')}
              </p>
            </div>
            {budgetRemaining != null && (
              <div className="md:col-span-2 text-sm">
                <span className="text-muted-foreground">Total budget remaining:</span>{' '}
                <span
                  className={
                    budgetRemaining < 0 ? 'font-medium text-red-600' : 'font-medium text-green-600'
                  }
                >
                  £{budgetRemaining.toLocaleString('en-GB')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
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
                  {baseFunding != null && (
                    <TableHead className="text-right">Base Unlocked</TableHead>
                  )}
                  {baseFunding != null && (
                    <TableHead className="text-right">Top-Up Unlocked</TableHead>
                  )}
                  <TableHead className="text-right">Deployed</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Milestones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {startups.map((startup) => (
                  // Split each startup's unlocked value into base and top-up layers for quick review.
                  // Base is capped at the configured per-startup amount.
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
                    {baseFunding != null && (
                      <TableCell className="text-right text-muted-foreground">
                        {'\u00A3'}
                        {Math.min(startup.unlocked, baseFunding).toLocaleString('en-GB')}
                      </TableCell>
                    )}
                    {baseFunding != null && (
                      <TableCell className="text-right text-muted-foreground">
                        {'\u00A3'}
                        {Math.max(0, startup.unlocked - baseFunding).toLocaleString('en-GB')}
                      </TableCell>
                    )}
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
