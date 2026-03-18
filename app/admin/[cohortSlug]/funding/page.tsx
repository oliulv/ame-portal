'use client'

import { useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { HowItWorks } from '@/components/ui/how-it-works'
import { BarChart3, Layers3, Save, Settings, Target, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function formatCurrency(value: number): string {
  return `£${value.toLocaleString('en-GB')}`
}

function parseCurrencyInput(raw: string): number {
  const normalized = raw.replace(/[£,\s]/g, '')
  if (normalized.length === 0) return 0

  const value = Number(normalized)
  return Number.isFinite(value) ? value : Number.NaN
}

function normalizeAmount(value: number): number {
  return Math.round(value * 100) / 100
}

export default function AdminFundingPage() {
  const params = useParams()
  const router = useRouter()
  const cohortSlug = params.cohortSlug as string

  const currentUser = useQuery(api.users.current)
  const isSuperAdmin = currentUser?.role === 'super_admin'

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const overview = useQuery(
    api.milestones.fundingOverview,
    cohort?._id ? { cohortId: cohort._id } : 'skip'
  )
  const updateFundingConfig = useMutation(api.cohorts.updateFundingConfig)

  const fundingBudgetValue = overview?.cohort.fundingBudget
  const baseFundingValue = overview?.cohort.baseFunding

  // Initialize inputs from server data; track last-seen server values to detect changes
  const lastServerValues = useRef<{ budget?: number | null; base?: number | null }>({})
  const [allocationInput, setAllocationInput] = useState('')
  const [baselineInput, setBaselineInput] = useState('')
  const [isSavingFundingConfig, setIsSavingFundingConfig] = useState(false)

  if (
    fundingBudgetValue !== undefined &&
    baseFundingValue !== undefined &&
    (lastServerValues.current.budget !== fundingBudgetValue ||
      lastServerValues.current.base !== baseFundingValue)
  ) {
    lastServerValues.current = { budget: fundingBudgetValue, base: baseFundingValue }
    setAllocationInput(String(fundingBudgetValue ?? 0))
    setBaselineInput(String(baseFundingValue ?? 0))
  }

  const isLoading = cohort === undefined || overview === undefined

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="mb-2 h-9 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-6 w-48" />
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
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
    cohort: { fundingBudget: 0, baseFunding: 0, startupCount: 0 },
  }

  const startupCount = cohortFunding.startupCount
  const savedTotalAllocation = cohortFunding.fundingBudget ?? 0
  const savedBaselinePerStartup = cohortFunding.baseFunding ?? 0

  const parsedAllocation = parseCurrencyInput(allocationInput)
  const parsedBaseline = parseCurrencyInput(baselineInput)
  const configIsValid =
    !Number.isNaN(parsedAllocation) &&
    !Number.isNaN(parsedBaseline) &&
    parsedAllocation >= 0 &&
    parsedBaseline >= 0

  const normalizedAllocationInput = configIsValid ? normalizeAmount(parsedAllocation) : 0
  const normalizedBaselineInput = configIsValid ? normalizeAmount(parsedBaseline) : 0
  const hasFundingConfigChanges =
    configIsValid &&
    (normalizeAmount(savedTotalAllocation) !== normalizedAllocationInput ||
      normalizeAmount(savedBaselinePerStartup) !== normalizedBaselineInput)

  const totalAllocation = configIsValid ? normalizedAllocationInput : savedTotalAllocation
  const baselinePerStartup = configIsValid ? normalizedBaselineInput : savedBaselinePerStartup

  const totalBaselineRequired = baselinePerStartup * startupCount
  const topUpPool = totalAllocation - totalBaselineRequired
  const totalUnlocked = totals.unlocked
  const totalDeployed = totals.deployed
  const unlockedNotYetDeployed = Math.max(0, totalUnlocked - totalDeployed)
  const remainingTopUpCapacity = Math.max(0, totalAllocation - totalUnlocked)

  const includedStartups = startups.filter((s) => !s.excludeFromMetrics)
  const baseUnlockedTotal = includedStartups.reduce(
    (sum, startup) => sum + Math.min(startup.unlocked, baselinePerStartup),
    0
  )
  const baseDeployedTotal = includedStartups.reduce(
    (sum, startup) => sum + Math.min(startup.deployed, baselinePerStartup),
    0
  )
  const baseAvailableTotal = Math.max(0, baseUnlockedTotal - baseDeployedTotal)

  const topUpUnlockedTotal = Math.max(0, totalUnlocked - baseUnlockedTotal)
  const topUpDeployedTotal = Math.max(0, totalDeployed - baseDeployedTotal)
  const topUpAvailableTotal = Math.max(0, topUpUnlockedTotal - topUpDeployedTotal)

  const unlockedOfAllocationPct = totalAllocation > 0 ? (totalUnlocked / totalAllocation) * 100 : 0
  const deployedOfAllocationPct = totalAllocation > 0 ? (totalDeployed / totalAllocation) * 100 : 0
  const baseUnlockedPct =
    totalBaselineRequired > 0 ? (baseUnlockedTotal / totalBaselineRequired) * 100 : 0

  const startupChartData = [...startups]
    .filter((s) => !s.excludeFromMetrics)
    .sort((a, b) => b.unlocked - a.unlocked)
    .map((startup) => ({
      name: startup.name,
      baseline: baselinePerStartup,
      unlocked: startup.unlocked,
      deployed: startup.deployed,
    }))

  const allocationPieData = [
    {
      name: 'Unlocked',
      value: Math.max(0, Math.min(totalUnlocked, totalAllocation)),
      color: 'hsl(var(--chart-2))',
    },
    {
      name: 'Unallocated',
      value: Math.max(0, totalAllocation - totalUnlocked),
      color: 'hsl(var(--chart-3))',
    },
    {
      name: 'Above allocation',
      value: Math.max(0, totalUnlocked - totalAllocation),
      color: 'hsl(var(--destructive))',
    },
  ].filter((item) => item.value > 0)

  async function handleSaveFundingConfig() {
    if (!cohort) return

    if (!configIsValid) {
      toast.error('Enter valid non-negative numbers for allocation and baseline')
      return
    }

    setIsSavingFundingConfig(true)
    try {
      await updateFundingConfig({
        cohortId: cohort._id,
        fundingBudget: normalizedAllocationInput,
        baseFunding: normalizedBaselineInput,
      })
      toast.success('Funding settings updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update funding settings')
    } finally {
      setIsSavingFundingConfig(false)
    }
  }

  function resetFundingInputs() {
    setAllocationInput(String(savedTotalAllocation))
    setBaselineInput(String(savedBaselinePerStartup))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Funding</h1>
          <p className="text-muted-foreground">Aggregate funding overview for {cohort.label}</p>
        </div>
        <Link href={`/admin/${cohortSlug}/milestones?tab=templates`}>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Milestone Templates
          </Button>
        </Link>
      </div>

      <HowItWorks title="How funding works">
        <p>
          <strong className="text-foreground">Funding is unlocked through milestones.</strong>{' '}
          Milestones are agreed upon between founders and the team. Upon completing all programme
          milestones, startups unlock at least £5,000 in baseline funding.
        </p>
        <p>
          Outstanding startups may unlock further funding later. Deployed = funding claimed via
          approved invoices. Available = remaining balance founders can still claim. The top-up pool
          is the budget above total baseline that can be allocated to high-performing startups.
        </p>
      </HowItWorks>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Cohort Funding Controls
            </CardTitle>
            <CardDescription>
              Adjust total allocation and baseline funding per startup. All rollups update
              immediately after save.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="total-allocation">Total allocation (GBP)</Label>
                <Input
                  id="total-allocation"
                  type="number"
                  min={0}
                  step="0.01"
                  value={allocationInput}
                  onChange={(e) => setAllocationInput(e.target.value)}
                  placeholder="70000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseline-startup">Baseline per startup (GBP)</Label>
                <Input
                  id="baseline-startup"
                  type="number"
                  min={0}
                  step="0.01"
                  value={baselineInput}
                  onChange={(e) => setBaselineInput(e.target.value)}
                  placeholder="5000"
                />
              </div>
              <div className="space-y-2">
                <Label>Startup count</Label>
                <div className="flex h-9 items-center  border bg-muted/40 px-3 text-sm font-medium">
                  {startupCount}
                </div>
              </div>
            </div>

            {!configIsValid && (
              <p className="text-sm text-red-600">
                Please use valid non-negative numbers for funding settings.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={resetFundingInputs}
                disabled={!hasFundingConfigChanges || isSavingFundingConfig}
              >
                Reset
              </Button>
              <Button
                onClick={handleSaveFundingConfig}
                disabled={!hasFundingConfigChanges || !configIsValid || isSavingFundingConfig}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSavingFundingConfig ? 'Saving...' : 'Save funding settings'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Allocation utilization</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalDeployed)} deployed of {formatCurrency(totalUnlocked)} unlocked
            </p>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500/30"
              style={{ width: `${Math.min(100, Math.max(0, unlockedOfAllocationPct))}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-blue-600"
              style={{ width: `${Math.min(100, Math.max(0, deployedOfAllocationPct))}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              Deployed {formatCurrency(totalDeployed)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500/50" />
              Unlocked {formatCurrency(totalUnlocked)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              Remaining top-up capacity {formatCurrency(remainingTopUpCapacity)}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground flex items-center">
              Total allocation
              <InfoTooltip text="The total funding budget for this cohort, set in funding controls above." />
            </p>
            <p className="mt-1 text-2xl font-bold font-display">
              {formatCurrency(totalAllocation)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground flex items-center">
              Baseline required
              <InfoTooltip text="The minimum funding reserved if all startups complete their milestones (startups x baseline per startup)." />
            </p>
            <p className="mt-1 text-2xl font-bold font-display">
              {formatCurrency(totalBaselineRequired)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {startupCount} startups x {formatCurrency(baselinePerStartup)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground flex items-center">
              Total unlocked
              <InfoTooltip text="Sum of all approved milestone amounts across all startups in this cohort." />
            </p>
            <p className="mt-1 text-2xl font-bold font-display">{formatCurrency(totalUnlocked)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {Math.round(unlockedOfAllocationPct)}% of total allocation
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground flex items-center">
              Top-up pool
              <InfoTooltip text="Budget above baseline that can be allocated to outstanding startups later in the programme. Total allocation minus baseline required." />
            </p>
            <p
              className={`mt-1 text-2xl font-bold font-display ${topUpPool < 0 ? 'text-red-600' : ''}`}
            >
              {formatCurrency(topUpPool)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Base Funding Layer</CardTitle>
            <CardDescription>
              Unlocked and deployed progress against baseline commitments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Baseline unlocked:{' '}
              <span className="font-medium">{formatCurrency(baseUnlockedTotal)}</span>
            </p>
            <p>
              Baseline deployed:{' '}
              <span className="font-medium text-blue-600">{formatCurrency(baseDeployedTotal)}</span>
            </p>
            <p>
              Baseline available:{' '}
              <span className="font-medium text-green-600">
                {formatCurrency(baseAvailableTotal)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {Math.round(baseUnlockedPct)}% of baseline unlocked across all startups.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top-Up Layer</CardTitle>
            <CardDescription>
              Funding above baseline, derived from unlocked and deployed totals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Top-up unlocked:{' '}
              <span className="font-medium">{formatCurrency(topUpUnlockedTotal)}</span>
            </p>
            <p>
              Top-up deployed:{' '}
              <span className="font-medium text-blue-600">
                {formatCurrency(topUpDeployedTotal)}
              </span>
            </p>
            <p>
              Top-up available:{' '}
              <span className="font-medium text-green-600">
                {formatCurrency(topUpAvailableTotal)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Unlocked not yet deployed: {formatCurrency(unlockedNotYetDeployed)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Startup Funding Comparison
            </CardTitle>
            <CardDescription>Baseline vs unlocked vs deployed for each startup.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {startupChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={startupChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    angle={-20}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatCurrency(Number(value))}
                  />
                  <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="baseline" name="Baseline" fill="hsl(var(--chart-3))" />
                  <Bar dataKey="unlocked" name="Unlocked" fill="hsl(var(--chart-2))" />
                  <Bar dataKey="deployed" name="Deployed" fill="hsl(var(--chart-1))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No startup data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers3 className="h-4 w-4" />
              Allocation Breakdown
            </CardTitle>
            <CardDescription>
              How the total cohort allocation is split between unlocked and remaining budget.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {allocationPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.name}: ${Math.round((entry.percent ?? 0) * 100)}%`}
                  >
                    {allocationPieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Set allocation to view breakdown
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per Startup Funding</CardTitle>
          <CardDescription>Click any startup row to open its detail page.</CardDescription>
        </CardHeader>
        <CardContent>
          {includedStartups.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Startup</TableHead>
                  <TableHead className="text-right">Baseline</TableHead>
                  <TableHead className="text-right">Unlocked</TableHead>
                  <TableHead className="text-right">Deployed</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">% Baseline Unlocked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {includedStartups.map((startup) => {
                  const baselineUnlockedPctForStartup =
                    baselinePerStartup > 0
                      ? (Math.min(startup.unlocked, baselinePerStartup) / baselinePerStartup) * 100
                      : 0

                  return (
                    <TableRow
                      key={startup._id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() =>
                        router.push(`/admin/${cohortSlug}/startups/${startup.slug || startup._id}`)
                      }
                    >
                      <TableCell className="font-medium">{startup.name}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(baselinePerStartup)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(startup.unlocked)}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        {formatCurrency(startup.deployed)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(startup.available)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="ml-auto w-28">
                          <div className="mb-1 text-xs font-medium">
                            {Math.round(baselineUnlockedPctForStartup)}%
                          </div>
                          <div className="h-1.5 rounded-full bg-muted">
                            <div
                              className="h-1.5 rounded-full bg-emerald-500"
                              style={{
                                width: `${Math.min(100, Math.max(0, baselineUnlockedPctForStartup))}%`,
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
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
