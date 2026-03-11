'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { logClientError } from '@/lib/logging'
import type { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { MilestoneTimeline } from '@/components/milestone-timeline'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ArrowLeft,
  Check,
  Clock,
  Edit,
  ExternalLink,
  FileText,
  RotateCw,
  Send,
  Target,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdminMilestoneDetailPage() {
  const params = useParams<{ cohortSlug: string; id: string }>()
  const router = useRouter()
  const cohortSlug = params.cohortSlug
  const milestoneId = params.id as Id<'milestones'>

  const milestone = useQuery(api.milestones.getForAdmin, { id: milestoneId })
  const currentUser = useQuery(api.users.current)
  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const canApproveMilestones = useQuery(
    api.adminPermissions.checkMyPermission,
    cohort ? { cohortId: cohort._id, permission: 'approve_milestones' as const } : 'skip'
  )
  const approveMilestone = useMutation(api.milestones.approve)
  const requestChangesMutation = useMutation(api.milestones.requestChanges)
  const removeMilestone = useMutation(api.milestones.remove)

  const [isApproving, setIsApproving] = useState(false)
  const [isRequestingChanges, setIsRequestingChanges] = useState(false)
  const [adminComment, setAdminComment] = useState('')

  const fileUrl = useQuery(
    api.milestones.getFileUrl,
    milestone?.planStorageId ? { storageId: milestone.planStorageId } : 'skip'
  )

  if (milestone === undefined || currentUser === undefined) {
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
          <Link href={`/admin/${cohortSlug}/milestones`}>
            <Button variant="outline">Back to Milestones</Button>
          </Link>
        }
      />
    )
  }

  async function handleApprove() {
    setIsApproving(true)
    try {
      await approveMilestone({ id: milestoneId })
      toast.success('Milestone approved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve milestone')
    } finally {
      setIsApproving(false)
    }
  }

  async function handleRequestChanges() {
    setIsRequestingChanges(true)
    try {
      await requestChangesMutation({
        id: milestoneId,
        adminComment: adminComment.trim() || undefined,
      })
      toast.success('Changes requested')
      setAdminComment('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to request changes')
    } finally {
      setIsRequestingChanges(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this milestone? This action cannot be undone.'))
      return
    try {
      await removeMilestone({ id: milestoneId })
      toast.success('Milestone deleted')
      router.push(`/admin/${cohortSlug}/milestones`)
    } catch (error) {
      logClientError('Failed to delete milestone:', error)
      toast.error('Failed to delete milestone')
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
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">{milestone.title}</h1>
            <p className="text-muted-foreground">
              {milestone.startupSlug ? (
                <Link
                  href={`/admin/${cohortSlug}/startups/${milestone.startupSlug}`}
                  className="hover:underline"
                >
                  {milestone.startupName}
                </Link>
              ) : (
                milestone.startupName
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge}
            <Link href={`/admin/${cohortSlug}/milestones/${milestoneId}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
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
                      <div>
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
                      </div>
                    )}
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Admin Actions */}
          {milestone.status === 'submitted' && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <TooltipProvider>
                  <div className="flex gap-3">
                    {canApproveMilestones === false ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0}>
                            <Button disabled className="bg-green-600 opacity-50">
                              <Check className="mr-2 h-4 w-4" />
                              Approve
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>You don&apos;t have permission to approve milestones</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        onClick={handleApprove}
                        disabled={isApproving || isRequestingChanges}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="mr-2 h-4 w-4" />
                        {isApproving ? 'Approving...' : 'Approve'}
                      </Button>
                    )}
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <Label htmlFor="admin-comment">Request Changes</Label>
                    <Textarea
                      id="admin-comment"
                      placeholder="Describe what needs to be revised (optional)..."
                      value={adminComment}
                      onChange={(e) => setAdminComment(e.target.value)}
                      disabled={canApproveMilestones === false}
                    />
                    {canApproveMilestones === false ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0}>
                            <Button
                              variant="outline"
                              disabled
                              className="border-amber-300 text-amber-700 opacity-50"
                            >
                              <RotateCw className="mr-2 h-4 w-4" />
                              Request Changes
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>You don&apos;t have permission to request changes on milestones</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={handleRequestChanges}
                        disabled={isApproving || isRequestingChanges}
                        className="border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        <RotateCw className="mr-2 h-4 w-4" />
                        {isRequestingChanges ? 'Requesting...' : 'Request Changes'}
                      </Button>
                    )}
                  </div>
                </TooltipProvider>
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
                        ? 'Review and approve or request changes'
                        : milestone.status === 'changes_requested'
                          ? 'Waiting for founder to revise and resubmit'
                          : 'Founder has not submitted yet'}
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
                  ? "This amount has been unlocked and added to the startup's available balance."
                  : 'This amount will be unlocked when the milestone is approved.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
