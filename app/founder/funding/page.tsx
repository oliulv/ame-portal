'use client'

import { useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { HowItWorks } from '@/components/ui/how-it-works'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, Clock, Search, Send, Building2 } from 'lucide-react'
import Link from 'next/link'

type MilestoneFilter = 'all' | 'waiting' | 'submitted' | 'approved'

export default function FounderFundingPage() {
  const milestones = useQuery(api.milestones.listForFounder)
  const fundingSummary = useQuery(api.milestones.fundingSummaryForFounder)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<MilestoneFilter>('all')

  const milestoneList = useMemo(() => milestones ?? [], [milestones])
  const potential = milestoneList.reduce((sum, m) => sum + m.amount, 0)
  const unlocked = milestoneList
    .filter((m) => m.status === 'approved')
    .reduce((sum, m) => sum + m.amount, 0)
  const deployed = fundingSummary?.deployed ?? 0
  const available = Math.max(0, unlocked - deployed)
  const cappedDeployed = Math.max(0, Math.min(deployed, unlocked))
  const unlockedPct = potential > 0 ? (unlocked / potential) * 100 : 0
  const deployedPct = potential > 0 ? (cappedDeployed / potential) * 100 : 0

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredMilestones = useMemo(() => {
    return milestoneList.filter((milestone) => {
      const matchesStatus = statusFilter === 'all' || milestone.status === statusFilter
      const matchesSearch =
        normalizedQuery.length === 0 ||
        milestone.title.toLowerCase().includes(normalizedQuery) ||
        milestone.description.toLowerCase().includes(normalizedQuery)
      return matchesStatus && matchesSearch
    })
  }, [milestoneList, normalizedQuery, statusFilter])

  if (milestones === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="mb-2 h-9 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-16 w-full" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (milestones.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Funding</h1>
          <p className="text-muted-foreground">Track your milestone-based funding</p>
        </div>
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No milestones yet"
          description="Your milestones will appear here once they are set up by your program admin."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Funding</h1>
        <p className="text-muted-foreground">Track your milestone-based funding</p>
      </div>

      <HowItWorks title="How funding works">
        <p>
          <strong className="text-foreground">Funding is unlocked through milestones.</strong> These
          milestones are agreed upon between you and the accelerator team to ensure funding flows to
          those doing exceptional work.
        </p>
        <p>
          Given that your startup completes all milestones in the programme, you will unlock at
          least <strong className="text-foreground">£5,000 in baseline funding</strong>. On top of
          this, outstanding startups may unlock further funding later in the programme when the team
          can gauge which startups deploy capital most effectively.
        </p>
        <p>
          Below you can see how much you have <strong className="text-foreground">unlocked</strong>{' '}
          (approved milestones), how much has been{' '}
          <strong className="text-foreground">deployed</strong> (approved reimbursements), and how
          much is <strong className="text-foreground">available</strong> to spend right now.
        </p>
        <p>
          To deploy your available funding, submit invoices for business expenses via the{' '}
          <Link href="/founder/invoices" className="font-medium text-primary hover:underline">
            Invoices page
          </Link>
          .
        </p>
      </HowItWorks>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Funding utilization</p>
            <p className="text-xs text-muted-foreground">
              Deployed £{deployed.toLocaleString('en-GB')} of £{unlocked.toLocaleString('en-GB')}{' '}
              unlocked
            </p>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500/25"
              style={{ width: `${unlockedPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-blue-600"
              style={{ width: `${deployedPct}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              Deployed £{deployed.toLocaleString('en-GB')}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500/40" />
              Available £{available.toLocaleString('en-GB')}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm font-medium text-muted-foreground flex items-center">
              Unlocked
              <InfoTooltip text="Total funding unlocked from approved milestones. Complete milestones to increase this amount." />
            </p>
            <p className="mt-1 text-2xl font-bold font-display">
              £{unlocked.toLocaleString('en-GB')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm font-medium text-muted-foreground flex items-center">
              Deployed
              <InfoTooltip text="Total amount submitted via invoices and approved for reimbursement. This is funding you have already spent." />
            </p>
            <p className="mt-1 text-2xl font-bold font-display text-blue-600">
              £{deployed.toLocaleString('en-GB')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm font-medium text-muted-foreground flex items-center">
              Available
              <InfoTooltip text="Unlocked minus deployed. This is the amount you can still claim via invoice submissions on the Invoices page." />
            </p>
            <p className="mt-1 text-2xl font-bold font-display text-green-600">
              £{available.toLocaleString('en-GB')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>Milestones</CardTitle>
            <p className="text-sm text-muted-foreground">
              Submit milestone evidence to unlock funding. Deploy your funding via the{' '}
              <Link href="/founder/invoices" className="text-primary hover:underline">
                Invoices page
              </Link>
              .
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search milestones"
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as MilestoneFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredMilestones.length > 0 ? (
            filteredMilestones.map((milestone) => (
              <Link key={milestone._id} href={`/founder/milestones/${milestone._id}`}>
                <Card className="shadow-none cursor-pointer transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="shrink-0">
                        {milestone.status === 'approved' ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                            <Check className="h-4 w-4 text-green-600" />
                          </div>
                        ) : milestone.status === 'submitted' ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                            <Clock className="h-4 w-4 text-amber-600" />
                          </div>
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                            <Send className="h-4 w-4 text-blue-600" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{milestone.title}</span>
                          {milestone.status === 'approved' && (
                            <Badge variant="success">Approved</Badge>
                          )}
                          {milestone.status === 'submitted' && (
                            <Badge variant="warning">Pending Review</Badge>
                          )}
                          {milestone.status === 'waiting' && (
                            <Badge variant="secondary">Waiting</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {milestone.description}
                        </p>
                        {milestone.dueDate && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Due: {new Date(milestone.dueDate).toLocaleDateString('en-GB')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          £{milestone.amount.toLocaleString('en-GB')}
                        </div>
                        {milestone.status === 'approved' && (
                          <div className="text-xs text-green-600">Unlocked</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <EmptyState
              noCard
              icon={<Search className="h-6 w-6" />}
              title="No milestones match your filters"
              description="Try changing the search term or selected state."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
