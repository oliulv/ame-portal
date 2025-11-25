'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle2, XCircle, DollarSign, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface InvoiceActionsProps {
  invoiceId: string
  currentStatus: string
}

export function InvoiceActions({ invoiceId, currentStatus }: InvoiceActionsProps) {
  const router = useRouter()
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'paid' | null>(null)

  const canApprove = currentStatus === 'submitted' || currentStatus === 'under_review'
  const canMarkPaid = currentStatus === 'approved'

  const handleAction = async (action: 'approve' | 'reject' | 'paid') => {
    setIsSubmitting(true)
    setActionType(action)

    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'paid',
          admin_comment: comment.trim() || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update invoice')
      }

      toast.success(
        action === 'approve'
          ? 'Invoice approved successfully'
          : action === 'reject'
            ? 'Invoice rejected'
            : 'Invoice marked as paid'
      )

      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update invoice')
    } finally {
      setIsSubmitting(false)
      setActionType(null)
      setComment('')
    }
  }

  return (
    <Card>
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
