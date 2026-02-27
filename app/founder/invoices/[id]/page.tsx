'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react'
import {
  getInvoiceStatusLabel,
  getInvoiceStatusVariant,
  type InvoiceStatus,
} from '@/lib/invoice-status'

export default function FounderInvoiceDetailPage() {
  const params = useParams<{ id: string }>()
  const invoiceId = params.id as Id<'invoices'>
  const invoicesData = useQuery(api.invoices.listForFounder)

  const invoice = useMemo(() => {
    if (!invoicesData?.invoices) return null
    return invoicesData.invoices.find((item) => item._id === invoiceId) ?? null
  }, [invoiceId, invoicesData])

  const fileUrl = useQuery(
    api.invoices.getFileUrl,
    invoice?.storageId ? { storageId: invoice.storageId } : 'skip'
  )

  if (invoicesData === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading invoice...</div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title="Invoice not found"
        description="This invoice does not exist or you do not have access to it."
        action={
          <Link href="/founder/invoices">
            <Button variant="outline">Back to invoices</Button>
          </Link>
        }
      />
    )
  }

  const status = invoice.status as InvoiceStatus

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Link href="/founder/invoices">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Invoices
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{invoice.vendorName}</h1>
            <p className="text-muted-foreground">Invoice details and review status</p>
          </div>
          <Badge variant={getInvoiceStatusVariant(status)}>{getInvoiceStatusLabel(status)}</Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">
                    {new Date(invoice.invoiceDate).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-mono text-lg font-semibold">
                    £{Number(invoice.amountGbp).toFixed(2)}
                  </p>
                </div>
                {invoice.dueDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium">
                      {new Date(invoice.dueDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {invoice.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="whitespace-pre-wrap text-sm">{invoice.description}</p>
                </div>
              )}

              <div>
                <p className="mb-1 text-sm text-muted-foreground">Uploaded file</p>
                {fileUrl ? (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    {invoice.fileName || 'View invoice'}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">Loading file...</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Submitted on{' '}
                {new Date(invoice._creationTime).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
              {invoice.approvedAt && (
                <p className="text-emerald-700">
                  Approved on {new Date(invoice.approvedAt).toLocaleDateString('en-GB')}
                </p>
              )}
              {invoice.paidAt && (
                <p className="text-blue-700">
                  Paid on {new Date(invoice.paidAt).toLocaleDateString('en-GB')}
                </p>
              )}
            </CardContent>
          </Card>

          {invoice.adminComment && (
            <Card>
              <CardHeader>
                <CardTitle>Admin Comment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{invoice.adminComment}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
