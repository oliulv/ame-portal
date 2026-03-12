'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { logClientError } from '@/lib/logging'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { MilestoneTimeline } from '@/components/milestone-timeline'
import {
  ArrowLeft,
  Check,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  RotateCw,
  Send,
  Target,
} from 'lucide-react'
import { toast } from 'sonner'

export default function FounderMilestoneDetailPage() {
  const params = useParams<{ id: string }>()
  const milestoneId = params.id as Id<'milestones'>

  const milestone = useQuery(api.milestones.getForFounder, { id: milestoneId })
  const submitMilestone = useMutation(api.milestones.submit)
  const withdrawMilestone = useMutation(api.milestones.withdraw)
  const generateUploadUrl = useMutation(api.milestones.generateUploadUrl)

  const [planLink, setPlanLink] = useState('')
  const [planFile, setPlanFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null)
  const [pdfViewerTitle, setPdfViewerTitle] = useState('')

  const fileUrl = useQuery(
    api.milestones.getFileUrl,
    milestone?.planStorageId ? { storageId: milestone.planStorageId } : 'skip'
  )

  if (milestone === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading milestone...</div>
      </div>
    )
  }

  if (!milestone) {
    return (
      <EmptyState
        icon={<Target className="h-6 w-6" />}
        title="Milestone not found"
        description="This milestone does not exist or you do not have access to it."
        action={
          <Link href="/founder/funding">
            <Button variant="outline">Back to Funding</Button>
          </Link>
        }
      />
    )
  }

  const requiresLink = milestone.requireLink !== false
  const requiresFile = milestone.requireFile !== false
  const onlyLink = requiresLink && !requiresFile
  const onlyFile = !requiresLink && requiresFile
  const canSubmitForm = onlyLink ? !!planLink : onlyFile ? !!planFile : !!planLink || !!planFile

  async function handleSubmit() {
    if (!planLink && !planFile) {
      toast.error('Please provide a plan link or upload a plan file')
      return
    }

    if (planFile && !planFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are accepted. Please upload a PDF document.')
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
        id: milestoneId,
        planLink: planLink || undefined,
        planStorageId,
        planFileName,
      })
      toast.success('Milestone submitted for review')
    } catch (error) {
      logClientError('Failed to submit milestone:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit milestone')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleWithdraw() {
    setIsWithdrawing(true)
    try {
      await withdrawMilestone({ id: milestoneId })
      toast.success('Submission withdrawn - you can now re-submit')
      setPlanLink('')
      setPlanFile(null)
    } catch (error) {
      logClientError('Failed to withdraw milestone:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to withdraw milestone')
    } finally {
      setIsWithdrawing(false)
    }
  }

  const statusIcon =
    milestone.status === 'approved' ? (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
        <Check className="h-4 w-4 text-green-600" />
      </div>
    ) : milestone.status === 'submitted' ? (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
        <Clock className="h-4 w-4 text-amber-600" />
      </div>
    ) : milestone.status === 'changes_requested' ? (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
        <RotateCw className="h-4 w-4 text-orange-600" />
      </div>
    ) : (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
        <Send className="h-4 w-4 text-blue-600" />
      </div>
    )

  const statusBadge =
    milestone.status === 'approved' ? (
      <Badge variant="success">Approved</Badge>
    ) : milestone.status === 'submitted' ? (
      <Badge variant="warning">Pending Review</Badge>
    ) : milestone.status === 'changes_requested' ? (
      <Badge variant="warning">Changes Requested</Badge>
    ) : (
      <Badge variant="secondary">Waiting</Badge>
    )

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Link href="/founder/funding">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Funding
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">{milestone.title}</h1>
            <p className="text-muted-foreground">Milestone details and submission</p>
          </div>
          {statusBadge}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          {/* Milestone details */}
          <Card>
            <CardHeader>
              <CardTitle>Milestone Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Funding Amount</p>
                  <p className="font-mono text-lg font-semibold">
                    £{milestone.amount.toLocaleString('en-GB')}
                  </p>
                </div>
                {milestone.dueDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium">
                      {new Date(milestone.dueDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{milestone.description}</p>
              </div>

              {/* Admin comment for changes_requested */}
              {milestone.status === 'changes_requested' && milestone.adminComment && (
                <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-sm font-medium text-amber-900">Changes Requested</p>
                  <p className="mt-1 text-sm text-amber-800 whitespace-pre-wrap">
                    {milestone.adminComment}
                  </p>
                </div>
              )}

              {/* Submitted evidence */}
              {(milestone.status === 'submitted' ||
                milestone.status === 'approved' ||
                milestone.status === 'changes_requested') &&
                (milestone.planLink || milestone.planStorageId) && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Submitted Evidence</p>
                    {milestone.planLink && (
                      <a
                        href={milestone.planLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {milestone.planLink}
                      </a>
                    )}
                    {milestone.planStorageId && fileUrl && (
                      <div className="inline-flex items-center gap-2">
                        {milestone.planFileName?.toLowerCase().endsWith('.pdf') ? (
                          <>
                            <button
                              onClick={() => {
                                setPdfViewerUrl(fileUrl)
                                setPdfViewerTitle(milestone.planFileName || 'Document')
                              }}
                              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                            >
                              <FileText className="h-4 w-4" />
                              {milestone.planFileName || 'View uploaded file'}
                              <Eye className="h-3 w-3" />
                            </button>
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                              title="Open in new tab"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </>
                        ) : (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-primary hover:underline"
                          >
                            <FileText className="h-4 w-4" />
                            {milestone.planFileName || 'View uploaded file'}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Submission form (for waiting or changes_requested milestones) */}
          {(milestone.status === 'waiting' || milestone.status === 'changes_requested') && (
            <Card>
              <CardHeader>
                <CardTitle>Submit Evidence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Provide evidence of your milestone completion.
                  {onlyLink && ' Submit a link to your work.'}
                  {onlyFile && ' Upload a document as evidence.'}
                  {!onlyLink && !onlyFile && ' Include a link or upload a document.'}
                </p>
                {requiresLink && (
                  <div className="space-y-2">
                    <Label htmlFor="plan-link">
                      Plan Link (URL){onlyLink ? '' : requiresFile ? '' : ' - or upload below'}
                    </Label>
                    <Input
                      id="plan-link"
                      type="url"
                      placeholder="https://docs.google.com/..."
                      value={planLink}
                      onChange={(e) => setPlanLink(e.target.value)}
                    />
                  </div>
                )}
                {requiresFile && (
                  <div className="space-y-2">
                    <Label htmlFor="plan-file">
                      Plan Document (PDF only){onlyFile ? '' : ' (Optional)'}
                    </Label>
                    <Input
                      id="plan-file"
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setPlanFile(e.target.files?.[0] ?? null)}
                      className="cursor-pointer"
                    />
                    {planFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {planFile.name} ({(planFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button onClick={handleSubmit} disabled={isSubmitting || !canSubmitForm}>
                    {isSubmitting ? 'Submitting...' : 'Submit for Review'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Withdraw option for submitted milestones */}
          {milestone.status === 'submitted' && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  Your submission is pending review. You can withdraw it to make changes and
                  re-submit.
                </p>
                <Button variant="outline" onClick={handleWithdraw} disabled={isWithdrawing}>
                  {isWithdrawing ? 'Withdrawing...' : 'Withdraw Submission'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Activity timeline */}
          <MilestoneTimeline milestoneId={milestoneId} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                {statusIcon}
                <div>
                  <p className="text-sm font-medium">
                    {milestone.status === 'approved'
                      ? 'Approved'
                      : milestone.status === 'submitted'
                        ? 'Pending Review'
                        : milestone.status === 'changes_requested'
                          ? 'Changes Requested'
                          : 'Waiting for Submission'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {milestone.status === 'approved'
                      ? `£${milestone.amount.toLocaleString('en-GB')} unlocked`
                      : milestone.status === 'submitted'
                        ? 'Your submission is being reviewed'
                        : milestone.status === 'changes_requested'
                          ? 'Please revise and resubmit'
                          : 'Submit evidence to unlock funding'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Funding</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display">
                £{milestone.amount.toLocaleString('en-GB')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {milestone.status === 'approved'
                  ? 'This amount has been unlocked and added to your available balance.'
                  : 'This amount will be unlocked when the milestone is approved.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      <Dialog
        open={!!pdfViewerUrl}
        onOpenChange={(open) => {
          if (!open) setPdfViewerUrl(null)
        }}
      >
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{pdfViewerTitle}</DialogTitle>
            <DialogDescription>Preview of the uploaded PDF document</DialogDescription>
          </DialogHeader>
          {pdfViewerUrl && <iframe src={pdfViewerUrl} className="flex-1 w-full rounded border" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
