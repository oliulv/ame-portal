'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertTriangle, FileText, Search } from 'lucide-react'
import {
  getInvoiceStatusLabel,
  getInvoiceStatusVariant,
  matchesInvoiceStatusFilter,
  type InvoiceStatus,
  type InvoiceStatusFilter,
} from '@/lib/invoice-status'

export default function FounderInvoicesPage() {
  const router = useRouter()
  const invoicesData = useQuery(api.invoices.listForFounder)
  const fundingSummary = useQuery(api.milestones.fundingSummaryForFounder)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('all')

  const invoices = useMemo(() => invoicesData?.invoices ?? [], [invoicesData])
  const canUpload = (fundingSummary?.available ?? 0) > 0
  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const status = invoice.status as InvoiceStatus
      const matchesStatus = matchesInvoiceStatusFilter(status, statusFilter)
      const matchesSearch =
        normalizedQuery.length === 0 ||
        invoice.vendorName.toLowerCase().includes(normalizedQuery) ||
        (invoice.fileName || '').toLowerCase().includes(normalizedQuery) ||
        (invoice.description || '').toLowerCase().includes(normalizedQuery)

      return matchesStatus && matchesSearch
    })
  }, [invoices, normalizedQuery, statusFilter])

  if (invoicesData === undefined || fundingSummary === undefined) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Invoices</h1>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Loading invoices...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Upload expenses and track each invoice through review and payment.
          </p>
        </div>
        {canUpload ? (
          <Link href="/founder/invoices/new">
            <Button>Upload Invoice</Button>
          </Link>
        ) : (
          <Button disabled>Upload Invoice</Button>
        )}
      </div>

      {!canUpload && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-900">No available balance</p>
            <p className="mt-0.5 text-sm text-amber-700">
              {fundingSummary.hasMilestones
                ? 'All unlocked funds have been deployed. Complete more milestones to unlock additional funding.'
                : 'No milestones have been set up yet. Contact your program admin for more information.'}
            </p>
            <Link
              href="/founder/funding"
              className="mt-1 inline-block text-sm font-medium text-amber-900 hover:underline"
            >
              View funding details →
            </Link>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <EmptyState
              noCard
              icon={<FileText className="h-6 w-6" />}
              title="No invoices yet"
              description="Upload your first invoice to start reimbursement review. You can always return to track status updates."
              action={
                canUpload ? (
                  <Link href="/founder/invoices/new">
                    <Button>Upload your first invoice</Button>
                  </Link>
                ) : (
                  <Link href="/founder/funding">
                    <Button variant="outline">Go to funding</Button>
                  </Link>
                )
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vendor, file, or description"
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as InvoiceStatusFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Showing {filteredInvoices.length} of {invoices.length} invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredInvoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const status = invoice.status as InvoiceStatus
                      return (
                        <TableRow
                          key={invoice._id}
                          className="cursor-pointer transition-colors hover:bg-muted/50"
                          onClick={() => router.push(`/founder/invoices/${invoice._id}`)}
                        >
                          <TableCell className="font-medium">{invoice.vendorName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(invoice.invoiceDate).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </TableCell>
                          <TableCell className="font-mono">
                            £{Number(invoice.amountGbp).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getInvoiceStatusVariant(status)}>
                              {getInvoiceStatusLabel(status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  noCard
                  icon={<Search className="h-6 w-6" />}
                  title="No invoices match your filters"
                  description="Try adjusting the search term or status filter."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
