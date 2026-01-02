import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
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
import { cached, cacheKeys, cacheTTL } from '@/lib/cache'

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

interface PageProps {
  params: Promise<{
    cohortSlug: string
    id: string
  }>
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { cohortSlug, id } = await params
  const supabase = await createClient()

  // Fetch cohort and invoice in parallel (both are needed for validation)
  const [cohort, invoiceResult] = await Promise.all([
    // Verify cohort exists (cached)
    cached(
      cacheKeys.cohort(cohortSlug),
      async () => {
        const { data, error } = await supabase
          .from('cohorts')
          .select('id, label, slug')
          .eq('slug', cohortSlug)
          .single()
        if (error || !data) return null
        return data
      },
      cacheTTL.cohort
    ),
    // Fetch invoice with startup info
    supabase
      .from('invoices')
      .select(
        `
        *,
        startups (
          id,
          name,
          slug,
          cohort_id
        )
      `
      )
      .eq('id', id)
      .single(),
  ])

  if (!cohort) {
    redirect('/admin/cohorts')
  }

  const invoice = invoiceResult.data
  if (invoiceResult.error || !invoice) {
    notFound()
  }

  // Verify invoice belongs to a startup in this cohort
  const startup = invoice.startups as {
    id: string
    name: string
    slug: string | null
    cohort_id: string
  } | null
  if (!startup || startup.cohort_id !== cohort.id) {
    notFound()
  }

  // Fetch founder who uploaded the invoice
  const { data: founderProfile } = await supabase
    .from('founder_profiles')
    .select('full_name, personal_email')
    .eq('user_id', invoice.uploaded_by_user_id)
    .single()

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
                  <p className="text-lg font-medium">{invoice.vendor_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Amount</label>
                  <p className="text-lg font-medium font-mono">
                    £{Number(invoice.amount_gbp).toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Invoice Date</label>
                  <p className="text-sm">
                    {new Date(invoice.invoice_date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                {invoice.due_date && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                    <p className="text-sm">
                      {new Date(invoice.due_date).toLocaleDateString('en-GB', {
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
                <a
                  href={invoice.file_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  View Invoice Document
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Admin Comments */}
          {invoice.admin_comment && (
            <Card>
              <CardHeader>
                <CardTitle>Admin Comment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{invoice.admin_comment}</p>
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
                <Link
                  href={`/admin/${cohortSlug}/startups/${startup.slug}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {startup.name}
                </Link>
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
                    <p className="text-sm font-medium">{founderProfile.full_name}</p>
                    <p className="text-xs text-muted-foreground">{founderProfile.personal_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(invoice.created_at).toLocaleDateString('en-GB', {
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
          {(invoice.approved_at || invoice.paid_at) && (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {invoice.approved_at && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      Approved on {new Date(invoice.approved_at).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                )}
                {invoice.paid_at && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <DollarSign className="h-4 w-4" />
                    <span>
                      Marked as paid on {new Date(invoice.paid_at).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {(canApprove || canMarkPaid) && (
            <InvoiceActions invoiceId={invoice.id} currentStatus={invoice.status} />
          )}
        </div>
      </div>
    </div>
  )
}
