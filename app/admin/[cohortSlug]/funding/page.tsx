'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { CalendarClock, Save, Settings, SlidersHorizontal, Target } from 'lucide-react'
import {
  Area,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'

function formatCurrency(value: number): string {
  return `£${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
}

function parseCurrencyInput(raw: string): number {
  const normalized = raw.replace(/[£,\s]/g, '')
  if (normalized.length === 0) return 0
  const value = Number(normalized)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : Number.NaN
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatCompactCurrency(value: number): string {
  const absolute = Math.abs(value)
  const prefix = value < 0 ? '-£' : '£'
  if (absolute >= 1000000) return `${prefix}${(absolute / 1000000).toFixed(1)}m`
  if (absolute >= 1000) return `${prefix}${(absolute / 1000).toFixed(0)}k`
  return formatCurrency(value)
}

function Metric({
  label,
  value,
  help,
  tone,
}: {
  label: string
  value: number
  help?: string
  tone?: 'default' | 'muted' | 'blue' | 'violet' | 'green'
}) {
  const valueClass =
    tone === 'muted'
      ? 'text-muted-foreground'
      : tone === 'blue'
        ? 'text-blue-600'
        : tone === 'violet'
          ? 'text-violet-600'
          : tone === 'green'
            ? 'text-green-600'
            : ''
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="flex items-center text-sm font-medium text-muted-foreground">
          {label}
          {help && <InfoTooltip text={help} />}
        </p>
        <p className={`mt-1 text-2xl font-bold font-display ${valueClass}`}>
          {formatCurrency(value)}
        </p>
      </CardContent>
    </Card>
  )
}

function getStackedSegments({
  total,
  deployed,
  committed,
  available,
}: {
  total: number
  deployed: number
  committed: number
  available: number
}) {
  const denominator = Math.max(total, 1)
  const deployedValue = Math.max(0, Math.min(deployed, denominator))
  const committedValue = Math.max(0, Math.min(committed, denominator - deployedValue))
  const availableValue = Math.max(
    0,
    Math.min(available, denominator - deployedValue - committedValue)
  )

  return {
    deployedPct: (deployedValue / denominator) * 100,
    committedPct: (committedValue / denominator) * 100,
    availablePct: (availableValue / denominator) * 100,
  }
}

function FundingUtilizationBar({
  total,
  deployed,
  committed,
  available,
}: {
  total: number
  deployed: number
  committed: number
  available: number
}) {
  const { deployedPct, committedPct, availablePct } = getStackedSegments({
    total,
    deployed,
    committed,
    available,
  })
  const committedLeft = deployedPct
  const availableLeft = deployedPct + committedPct

  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-muted">
      {total > 0 && (
        <>
          <div
            className="absolute inset-y-0 left-0 bg-blue-600 transition-all"
            style={{ width: `${deployedPct}%` }}
          />
          <div
            className="absolute inset-y-0 bg-violet-500 transition-all"
            style={{ left: `${committedLeft}%`, width: `${committedPct}%` }}
          />
          <div
            className="absolute inset-y-0 bg-emerald-500/60 transition-all"
            style={{ left: `${availableLeft}%`, width: `${availablePct}%` }}
          />
        </>
      )}
    </div>
  )
}

function MiniFundingBar({
  total,
  deployed,
  committed,
  available,
}: {
  total: number
  deployed: number
  committed: number
  available: number
}) {
  const { deployedPct, committedPct, availablePct } = getStackedSegments({
    total,
    deployed,
    committed,
    available,
  })

  return (
    <div className="min-w-[128px] space-y-1">
      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        {total > 0 && (
          <>
            <div
              className="absolute inset-y-0 left-0 bg-blue-600 transition-all"
              style={{ width: `${deployedPct}%` }}
            />
            <div
              className="absolute inset-y-0 bg-violet-500 transition-all"
              style={{ left: `${deployedPct}%`, width: `${committedPct}%` }}
            />
            <div
              className="absolute inset-y-0 bg-emerald-500/60 transition-all"
              style={{ left: `${deployedPct + committedPct}%`, width: `${availablePct}%` }}
            />
          </>
        )}
      </div>
      <p className="text-right text-[10px] text-muted-foreground">
        {formatCurrency(Math.max(0, deployed + committed))} / {formatCurrency(total)}
      </p>
    </div>
  )
}

function LegendDot({ className }: { className: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} />
}

function AllocationPie({
  total,
  deployed,
  committed,
  available,
}: {
  total: number
  deployed: number
  committed: number
  available: number
}) {
  const remainingAllocation = Math.max(0, total - deployed - committed - available)
  const data = [
    { name: 'Deployed', value: deployed, color: '#2563eb' },
    { name: 'Committed', value: committed, color: '#8b5cf6' },
    { name: 'Available', value: available, color: '#10b981' },
    { name: 'Remaining allocation', value: remainingAllocation, color: 'hsl(var(--muted))' },
  ].filter((item) => item.value > 0)

  if (data.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center border border-dashed text-sm text-muted-foreground">
        No allocation configured
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={84}
              outerRadius={130}
              paddingAngle={2}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(Number(value))}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0px',
                fontSize: '12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </span>
            <span className="font-medium tabular-nums">{formatCurrency(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BreakdownRow({ label, value, help }: { label: string; value: number; help?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm border-b last:border-b-0">
      <span className="flex items-center text-muted-foreground">
        {label}
        {help && <InfoTooltip text={help} />}
      </span>
      <span className="text-right font-medium tabular-nums">{formatCurrency(value)}</span>
    </div>
  )
}

export default function AdminFundingPage() {
  const params = useParams()
  const router = useRouter()
  const cohortSlug = params.cohortSlug as string

  const currentUser = useQuery(api.users.current)
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const dashboard = useQuery(
    api.funding.dashboardForAdmin,
    cohort?._id ? { cohortId: cohort._id } : 'skip'
  )
  const updateCohortSettings = useMutation(api.funding.updateCohortSettings)

  const [selectedSeries, setSelectedSeries] = useState('aggregate')
  const [allocationInput, setAllocationInput] = useState('')
  const [baselineInput, setBaselineInput] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fundingBudgetSetting = dashboard?.cohort.fundingBudget
  const baseFundingSetting = dashboard?.cohort.baseFunding

  useEffect(() => {
    if (fundingBudgetSetting === undefined || baseFundingSetting === undefined) return
    setAllocationInput(String(fundingBudgetSetting ?? 0))
    setBaselineInput(String(baseFundingSetting ?? 0))
  }, [fundingBudgetSetting, baseFundingSetting])

  const isLoading = cohort === undefined || dashboard === undefined

  const selectedPoints = useMemo(() => {
    if (!dashboard) return []
    if (selectedSeries === 'aggregate') return dashboard.timeSeries.aggregate
    return (
      dashboard.timeSeries.byStartup.find((series) => series.startupId === selectedSeries)
        ?.points ?? []
    )
  }, [dashboard, selectedSeries])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="mb-2 h-9 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
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

  const parsedAllocation = parseCurrencyInput(allocationInput)
  const parsedBaseline = parseCurrencyInput(baselineInput)
  const configIsValid =
    !Number.isNaN(parsedAllocation) &&
    !Number.isNaN(parsedBaseline) &&
    parsedAllocation >= 0 &&
    parsedBaseline >= 0
  const savedAllocation = dashboard.cohort.fundingBudget ?? 0
  const savedBaseline = dashboard.cohort.baseFunding ?? 0
  const hasConfigChanges =
    configIsValid && (parsedAllocation !== savedAllocation || parsedBaseline !== savedBaseline)

  async function handleSaveFundingConfig() {
    if (!cohort || !configIsValid) {
      toast.error('Enter valid non-negative numbers for allocation and baseline')
      return
    }

    setIsSaving(true)
    try {
      await updateCohortSettings({
        cohortId: cohort._id,
        fundingBudget: parsedAllocation,
        baseFunding: parsedBaseline,
      })
      toast.success('Funding settings updated')
      setSettingsOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update funding settings')
    } finally {
      setIsSaving(false)
    }
  }

  const { position } = dashboard
  const moneyLeftOverall = Math.max(0, position.totalAllocation - position.deployed)
  const remainingAllocation = Math.max(
    0,
    position.totalAllocation - position.deployed - position.committed - position.available
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Funding</h1>
          <p className="text-muted-foreground">Aggregate funding overview for {cohort.label}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/${cohortSlug}/milestones?tab=templates`}>
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Milestone templates
            </Button>
          </Link>
          {isSuperAdmin && (
            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Funding settings
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[calc(100vw-2rem)] p-4 sm:w-[360px]">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">Funding settings</h2>
                  <p className="text-xs text-muted-foreground">
                    Update the cohort allocation and baseline reserve. Changes are audited.
                  </p>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="total-allocation">Total allocation (GBP)</Label>
                    <Input
                      id="total-allocation"
                      type="number"
                      min={0}
                      step="0.01"
                      value={allocationInput}
                      onChange={(event) => setAllocationInput(event.target.value)}
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
                      onChange={(event) => setBaselineInput(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Included startup count</Label>
                    <div className="flex h-10 items-center border bg-muted/40 px-3 text-sm font-medium">
                      {dashboard.cohort.includedStartupCount}
                    </div>
                  </div>
                  {!configIsValid && (
                    <p className="text-sm text-destructive">
                      Use valid non-negative numbers for both funding settings.
                    </p>
                  )}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAllocationInput(String(savedAllocation))
                      setBaselineInput(String(savedBaseline))
                    }}
                    disabled={!hasConfigChanges || isSaving}
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={handleSaveFundingConfig}
                    disabled={!hasConfigChanges || !configIsValid || isSaving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save settings'}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Metric label="Total allocation" value={position.totalAllocation} />
        <Metric
          label="Money left"
          value={moneyLeftOverall}
          help="Total allocation minus deployed funding."
        />
        <Metric label="Available" value={position.available} tone="green" />
        <Metric label="Committed" value={position.committed} tone="violet" />
        <Metric label="Deployed" value={position.deployed} tone="blue" />
        <Metric label="Top-up pool" value={position.topUpPool} tone="muted" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funding utilization</CardTitle>
          <CardDescription>
            Deployed {formatCurrency(position.deployed)} of{' '}
            {formatCurrency(position.totalAllocation)} allocated
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FundingUtilizationBar
            total={position.totalAllocation}
            deployed={position.deployed}
            committed={position.committed}
            available={position.available}
          />
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <LegendDot className="bg-blue-600" />
              Deployed {formatCurrency(position.deployed)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LegendDot className="bg-violet-500" />
              Committed {formatCurrency(position.committed)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LegendDot className="bg-emerald-500/60" />
              Available {formatCurrency(position.available)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LegendDot className="bg-muted" />
              Remaining allocation {formatCurrency(remainingAllocation)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" />
              Funding History
            </CardTitle>
            <CardDescription>
              Daily snapshots for entitled, unlocked, deployed, and available funding.
            </CardDescription>
          </div>
          <Select value={selectedSeries} onValueChange={setSelectedSeries}>
            <SelectTrigger className="w-full lg:w-64">
              <SelectValue placeholder="Select series" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aggregate">Aggregate cohort</SelectItem>
              {dashboard.timeSeries.byStartup.map((series) => (
                <SelectItem key={series.startupId} value={series.startupId}>
                  {series.startupName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={selectedPoints}>
                <defs>
                  <linearGradient id="funding-available-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => formatCompactCurrency(Number(value))}
                  width={64}
                />
                <Tooltip
                  labelFormatter={(value) =>
                    new Date(String(value)).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  }
                  formatter={(value: number, name: string) => [formatCurrency(Number(value)), name]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="available"
                  name="Available"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#funding-available-gradient)"
                  dot={false}
                  animationDuration={500}
                />
                <Line
                  type="monotone"
                  dataKey="entitled"
                  name="Entitled"
                  stroke="hsl(var(--foreground))"
                  dot={false}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  animationDuration={500}
                />
                <Line
                  type="monotone"
                  dataKey="unlocked"
                  name="Unlocked"
                  stroke="hsl(var(--chart-2))"
                  dot={false}
                  strokeWidth={2}
                  animationDuration={500}
                />
                <Line
                  type="monotone"
                  dataKey="deployed"
                  name="Deployed"
                  stroke="#2563eb"
                  dot={false}
                  strokeWidth={2}
                  animationDuration={500}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: 'hsl(var(--chart-1))' }}
              />
              Available
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: 'hsl(var(--chart-2))' }}
              />
              Unlocked
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LegendDot className="bg-blue-600" />
              Deployed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3 bg-foreground/70" />
              Entitled
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Allocation breakdown</CardTitle>
          <CardDescription>
            Total allocation split by deployed, committed, available, and remaining funding.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <AllocationPie
            total={position.totalAllocation}
            deployed={position.deployed}
            committed={position.committed}
            available={position.available}
          />
          <div>
            <BreakdownRow label="Baseline reserve" value={position.baselineReserve} />
            <BreakdownRow label="Top-ups allocated" value={position.topUpsAllocated} />
            <BreakdownRow label="Deductions returned" value={position.deductionsReturned} />
            <BreakdownRow label="Top-up pool" value={position.topUpPool} />
            <BreakdownRow
              label="Claimable"
              value={position.claimable}
              help="Unlocked funding that can be committed or deployed."
            />
            <BreakdownRow label="Remaining allocation" value={remainingAllocation} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Startup funding</CardTitle>
          <CardDescription>Click a row to open startup-specific funding controls.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {dashboard.startups.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Startup</TableHead>
                  <TableHead className="text-right">Baseline</TableHead>
                  <TableHead className="text-right">Top-up</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Entitlement</TableHead>
                  <TableHead className="text-right">Unlocked</TableHead>
                  <TableHead className="text-right">Committed</TableHead>
                  <TableHead className="text-right">Deployed</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="pr-6 text-right">Usage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.startups.map((startup) => (
                  <TableRow
                    key={startup.startupId}
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
                    onClick={() =>
                      router.push(
                        `/admin/${cohortSlug}/startups/${startup.slug || startup.startupId}`
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        router.push(
                          `/admin/${cohortSlug}/startups/${startup.slug || startup.startupId}`
                        )
                      }
                    }}
                  >
                    <TableCell className="pl-6 font-medium whitespace-nowrap">
                      {startup.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(startup.baseline)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(startup.topUp)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(startup.deductions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(startup.entitlement)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(startup.unlocked)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap text-violet-700">
                      {formatCurrency(startup.committed)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap text-blue-700">
                      {formatCurrency(startup.deployed)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap font-medium text-green-700">
                      {formatCurrency(startup.available)}
                    </TableCell>
                    <TableCell className="w-[140px] pr-6">
                      <MiniFundingBar
                        total={startup.claimable}
                        deployed={startup.deployed}
                        committed={startup.committed}
                        available={startup.available}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="px-6 pb-6">
              <EmptyState
                noCard
                icon={<Target className="h-6 w-6" />}
                title="No included startups"
                description="Included startups will appear here once they are added to the cohort."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
