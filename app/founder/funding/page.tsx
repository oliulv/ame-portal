'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { logClientError } from '@/lib/logging'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, Clock, Search, Send, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'

type MilestoneFilter = 'all' | 'waiting' | 'submitted' | 'approved'

export default function FounderFundingPage() {
  const milestones = useQuery(api.milestones.listForFounder)
  const fundingSummary = useQuery(api.milestones.fundingSummaryForFounder)
  const submitMilestone = useMutation(api.milestones.submit)
  const withdrawMilestone = useMutation(api.milestones.withdraw)
  const generateUploadUrl = useMutation(api.milestones.generateUploadUrl)

  const [submitDialogId, setSubmitDialogId] = useState<Id<'milestones'> | null>(null)
  const [planLink, setPlanLink] = useState('')
  const [planFile, setPlanFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [withdrawingId, setWithdrawingId] = useState<Id<'milestones'> | null>(null)
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

  function openSubmitDialog(id: Id<'milestones'>) {
    setSubmitDialogId(id)
    setPlanLink('')
    setPlanFile(null)
  }

  async function handleWithdraw(id: Id<'milestones'>) {
    setWithdrawingId(id)
    try {
      await withdrawMilestone({ id })
      toast.success('Submission withdrawn — you can now re-submit')
    } catch (error) {
      logClientError('Failed to withdraw milestone:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to withdraw milestone')
    } finally {
      setWithdrawingId(null)
    }
  }

  async function handleSubmit() {
    if (!submitDialogId) return
    if (!planLink && !planFile) {
      toast.error('Please provide a plan link or upload a plan file')
      return
    }

    setIsSubmitting(true)
    try {
      let planStorageId: Id<'_storage'> | undefined
      let planFileName: string | undefined

      if (planFile) {
        const uploadUrl = await generateUploadUrl()
        const result = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': planFile.type },
          body: planFile,
        })
        if (!result.ok) throw new Error('Failed to upload file')
        const { storageId } = await result.json()
        planStorageId = storageId
        planFileName = planFile.name
      }

      await submitMilestone({
        id: submitDialogId,
        planLink: planLink || undefined,
        planStorageId,
        planFileName,
      })
      toast.success('Milestone submitted for review')
      setSubmitDialogId(null)
    } catch (error) {
      logClientError('Failed to submit milestone:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit milestone')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Funding</h1>
        <p className="text-muted-foreground">Track your milestone-based funding</p>
      </div>

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
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Unlocked</p>
            <p className="mt-1 text-2xl font-bold font-display">
              £{unlocked.toLocaleString('en-GB')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Deployed</p>
            <p className="mt-1 text-2xl font-bold font-display text-blue-600">
              £{deployed.toLocaleString('en-GB')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Available</p>
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
              Submit milestone evidence to unlock and deploy more funding.
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
        <CardContent className="space-y-3">
          {filteredMilestones.length > 0 ? (
            filteredMilestones.map((milestone) => (
              <Card key={milestone._id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div>
                      {milestone.status === 'approved' ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                          <Check className="h-5 w-5 text-green-600" />
                        </div>
                      ) : milestone.status === 'submitted' ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                          <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                          <Send className="h-5 w-5 text-blue-600" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{milestone.title}</span>
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
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {milestone.description}
                      </p>
                      {milestone.dueDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Due: {new Date(milestone.dueDate).toLocaleDateString('en-GB')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        £{milestone.amount.toLocaleString('en-GB')}
                      </div>
                      {milestone.status === 'approved' && (
                        <div className="text-xs text-green-600">Unlocked</div>
                      )}
                    </div>
                    {milestone.status === 'waiting' && (
                      <Button size="sm" onClick={() => openSubmitDialog(milestone._id)}>
                        Submit
                      </Button>
                    )}
                    {milestone.status === 'submitted' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleWithdraw(milestone._id)}
                        disabled={withdrawingId === milestone._id}
                      >
                        {withdrawingId === milestone._id ? 'Withdrawing...' : 'Withdraw'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
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

      <Dialog open={!!submitDialogId} onOpenChange={(open) => !open && setSubmitDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Milestone</DialogTitle>
            <DialogDescription>
              Provide evidence of your milestone completion. Include a link to your plan or upload a
              document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="plan-link">Plan Link (URL)</Label>
              <Input
                id="plan-link"
                type="url"
                placeholder="https://docs.google.com/..."
                value={planLink}
                onChange={(e) => setPlanLink(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-file">Plan Document (Optional)</Label>
              <Input
                id="plan-file"
                type="file"
                accept="application/pdf,image/*,.doc,.docx"
                onChange={(e) => setPlanFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer"
              />
              {planFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {planFile.name} ({(planFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            {!planLink && !planFile && (
              <p className="text-sm text-muted-foreground">
                Please provide at least a plan link or upload a file.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogId(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || (!planLink && !planFile)}>
              {isSubmitting ? 'Submitting...' : 'Submit for Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
