'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
  const canApprove = statusAllowsApprove && canApproveInvoices === true
  const canMarkPaid = currentStatus === 'approved'

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

  if (!canApprove && !canMarkPaid) return null

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
            disabled={isSubmitting}
          />
        </div>

        <div className="flex flex-col gap-2">
          {canApprove && (
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
          )}
          {canMarkPaid && (
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
          )}
        </div>
      </CardContent>
    </Card>
  )
}
