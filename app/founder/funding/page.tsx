'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Check, Clock, Send, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'

export default function FounderFundingPage() {
  const milestones = useQuery(api.milestones.listForFounder)
  const submitMilestone = useMutation(api.milestones.submit)
  const generateUploadUrl = useMutation(api.milestones.generateUploadUrl)

  const [submitDialogId, setSubmitDialogId] = useState<Id<'milestones'> | null>(null)
  const [planLink, setPlanLink] = useState('')
  const [planFile, setPlanFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (milestones === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
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
          <h1 className="text-3xl font-bold tracking-tight">Funding</h1>
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

  const potential = milestones.reduce((sum, m) => sum + m.amount, 0)
  const unlocked = milestones
    .filter((m) => m.status === 'approved')
    .reduce((sum, m) => sum + m.amount, 0)
  const unlockedPct = potential > 0 ? (unlocked / potential) * 100 : 0

  function openSubmitDialog(id: Id<'milestones'>) {
    setSubmitDialogId(id)
    setPlanLink('')
    setPlanFile(null)
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
      console.error('Failed to submit milestone:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit milestone')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Funding</h1>
        <p className="text-muted-foreground">Track your milestone-based funding</p>
      </div>

      {/* Funding bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Funding Progress</span>
            <span className="text-sm text-muted-foreground">
              {'\u00A3'}
              {unlocked.toLocaleString('en-GB')} / {'\u00A3'}
              {potential.toLocaleString('en-GB')}
            </span>
          </div>
          <div className="h-4 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${unlockedPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{Math.round(unlockedPct)}% unlocked</p>
        </CardContent>
      </Card>

      {/* Milestones */}
      <div className="space-y-3">
        {milestones.map((milestone) => (
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
                    {milestone.status === 'approved' && <Badge variant="success">Approved</Badge>}
                    {milestone.status === 'submitted' && (
                      <Badge variant="warning">Pending Review</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{milestone.description}</p>
                  {milestone.dueDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {new Date(milestone.dueDate).toLocaleDateString('en-GB')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {'\u00A3'}
                    {milestone.amount.toLocaleString('en-GB')}
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submit Milestone Dialog */}
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
