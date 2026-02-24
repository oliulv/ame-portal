'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  FileText,
  ExternalLink,
  Calendar,
  Building2,
  User,
} from 'lucide-react'
import { InvoiceActions } from './InvoiceActions'

function getInvoiceStatusVariant(
  status: string
): 'success' | 'warning' | 'destructive' | 'info' | 'secondary' {
  switch (status) {
    case 'approved':
      return 'success'
    case 'rejected':
      return 'destructive'
    case 'paid':
      return 'info'
    default:
      return 'warning'
  }
}

export default function InvoiceDetailPage() {
  const params = useParams<{ cohortSlug: string; id: string }>()
  const router = useRouter()
  const cohortSlug = params.cohortSlug ?? ''
  const invoiceId = params.id as Id<'invoices'>

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const invoice = useQuery(api.invoices.getById, { id: invoiceId })
  const startup = useQuery(
    api.startups.getById,
    invoice?.startupId ? { id: invoice.startupId } : 'skip'
  )
  const fileUrl = useQuery(
    api.invoices.getFileUrl,
    invoice?.storageId ? { storageId: invoice.storageId } : 'skip'
  )
  const founderProfile = useQuery(
    api.founderProfile.getByUserId,
    invoice?.uploadedByUserId ? { userId: invoice.uploadedByUserId } : 'skip'
  )

  // Loading state
  if (cohort === undefined || invoice === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading invoice...</div>
      </div>
    )
  }

  // Cohort not found
  if (!cohort) {
    router.push('/admin/cohorts')
    return null
  }

  // Invoice not found
  if (!invoice) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Invoice Not Found</h2>
          <p className="text-muted-foreground mb-4">This invoice does not exist.</p>
          <Link href={`/admin/${cohortSlug}/invoices`}>
            <Button variant="ghost">Back to Invoices</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Verify invoice belongs to a startup in this cohort
  if (startup && startup.cohortId !== cohort._id) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Invoice Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This invoice does not belong to the current cohort.
          </p>
          <Link href={`/admin/${cohortSlug}/invoices`}>
            <Button variant="ghost">Back to Invoices</Button>
          </Link>
        </div>
      </div>
    )
  }

  const canApprove = invoice.status === 'submitted' || invoice.status === 'under_review'
  const canMarkPaid = invoice.status === 'approved'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/${cohortSlug}/invoices`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Invoice Review</h1>
          <p className="text-muted-foreground">
            Review invoice details and approve or reject reimbursement
          </p>
        </div>
        <Badge variant={getInvoiceStatusVariant(invoice.status)} className="text-sm">
          {invoice.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>Information about this invoice submission</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Vendor Name</label>
                  <p className="text-lg font-medium">{invoice.vendorName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Amount</label>
                  <p className="text-lg font-medium font-mono">
                    {'\u00A3'}
                    {Number(invoice.amountGbp).toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Invoice Date</label>
                  <p className="text-sm">
                    {new Date(invoice.invoiceDate).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                {invoice.dueDate && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                    <p className="text-sm">
                      {new Date(invoice.dueDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
                {invoice.category && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Category</label>
                    <p className="text-sm">{invoice.category}</p>
                  </div>
                )}
              </div>

              {invoice.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="text-sm whitespace-pre-wrap">{invoice.description}</p>
                </div>
              )}

              {/* Invoice File */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Invoice File
                </label>
                {fileUrl ? (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    {invoice.fileName || 'View Invoice Document'}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">Loading file...</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Admin Comments */}
          {invoice.adminComment && (
            <Card>
              <CardHeader>
                <CardTitle>Admin Comment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{invoice.adminComment}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Startup Info */}
          <Card>
            <CardHeader>
              <CardTitle>Startup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {startup ? (
                  <Link
                    href={`/admin/${cohortSlug}/startups/${startup.slug}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {startup.name}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">Loading...</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Uploader Info */}
          {founderProfile && (
            <Card>
              <CardHeader>
                <CardTitle>Uploaded By</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{founderProfile.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {founderProfile.personalEmail}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(invoice._creationTime).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval History */}
          {(invoice.approvedAt || invoice.paidAt) && (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {invoice.approvedAt && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      Approved on {new Date(invoice.approvedAt).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                )}
                {invoice.paidAt && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <DollarSign className="h-4 w-4" />
                    <span>
                      Marked as paid on {new Date(invoice.paidAt).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {(canApprove || canMarkPaid) && (
            <InvoiceActions invoiceId={invoice._id} currentStatus={invoice.status} />
          )}
        </div>
      </div>
    </div>
  )
}
