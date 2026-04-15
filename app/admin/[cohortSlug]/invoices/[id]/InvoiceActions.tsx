'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle2, XCircle, DollarSign, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface InvoiceActionsProps {
  invoiceId: Id<'invoices'>
  currentStatus: string
  cohortId: Id<'cohorts'>
  startupId: Id<'startups'>
  className?: string
  onApproved?: () => void
}

export function InvoiceActions({
  invoiceId,
  currentStatus,
  cohortId,
  startupId,
  className,
  onApproved,
}: InvoiceActionsProps) {
  const updateStatus = useMutation(api.invoices.updateStatus)
  const canApproveInvoices = useQuery(api.adminPermissions.checkMyPermission, {
    cohortId,
    permission: 'approve_invoices' as const,
    startupId,
  })
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'paid' | null>(null)

  const statusAllowsApprove = currentStatus === 'submitted' || currentStatus === 'under_review'
  const statusAllowsPaid = currentStatus === 'approved'
  const permissionLoading = canApproveInvoices === undefined
  const hasPermission = canApproveInvoices === true

  const handleAction = async (action: 'approve' | 'reject' | 'paid') => {
    setIsSubmitting(true)
    setActionType(action)

    try {
      const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'paid'

      await updateStatus({
        id: invoiceId,
        status: status as 'approved' | 'rejected' | 'paid',
        adminComment: comment.trim() || undefined,
      })

      toast.success(
        action === 'approve'
          ? 'Invoice approved successfully'
          : action === 'reject'
            ? 'Invoice rejected'
            : 'Invoice marked as paid'
      )

      if (action === 'approve' && onApproved) {
        onApproved()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update invoice')
    } finally {
      setIsSubmitting(false)
      setActionType(null)
      setComment('')
    }
  }

  // Hide the entire card only when there's nothing to show regardless of
  // permission (status doesn't allow any action). If the status allows an
  // action but the user lacks permission, render disabled buttons with a
  // tooltip — same UX as the milestones detail page.
  if (!statusAllowsApprove && !statusAllowsPaid) return null

  const permissionTooltip = "You don't have permission to approve invoices for this startup"

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>Review and take action on this invoice</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="comment">Comment (Optional)</Label>
          <Textarea
            id="comment"
            placeholder="Add a comment about your decision..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            disabled={isSubmitting || !hasPermission}
          />
        </div>

        <TooltipProvider>
          <div className="flex flex-col gap-2">
            {statusAllowsApprove && (
              <>
                {hasPermission ? (
                  <>
                    <Button
                      onClick={() => handleAction('approve')}
                      disabled={isSubmitting}
                      className="w-full"
                      variant="default"
                    >
                      {isSubmitting && actionType === 'approve' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Approve Invoice
                    </Button>
                    <Button
                      onClick={() => handleAction('reject')}
                      disabled={isSubmitting}
                      className="w-full"
                      variant="destructive"
                    >
                      {isSubmitting && actionType === 'reject' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Reject Invoice
                    </Button>
                  </>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="flex flex-col gap-2">
                        <Button disabled className="w-full opacity-50">
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {permissionLoading ? 'Loading…' : 'Approve Invoice'}
                        </Button>
                        <Button disabled variant="destructive" className="w-full opacity-50">
                          <XCircle className="mr-2 h-4 w-4" />
                          {permissionLoading ? 'Loading…' : 'Reject Invoice'}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!permissionLoading && (
                      <TooltipContent>
                        <p>{permissionTooltip}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                )}
              </>
            )}
            {statusAllowsPaid &&
              (hasPermission ? (
                <Button
                  onClick={() => handleAction('paid')}
                  disabled={isSubmitting}
                  className="w-full"
                  variant="default"
                >
                  {isSubmitting && actionType === 'paid' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <DollarSign className="mr-2 h-4 w-4" />
                  )}
                  Mark as Paid
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button disabled className="w-full opacity-50">
                        <DollarSign className="mr-2 h-4 w-4" />
                        {permissionLoading ? 'Loading…' : 'Mark as Paid'}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!permissionLoading && (
                    <TooltipContent>
                      <p>{permissionTooltip}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
