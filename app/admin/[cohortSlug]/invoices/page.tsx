'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
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
import { HowItWorks } from '@/components/ui/how-it-works'
import { FileText, AlertCircle, ExternalLink, Users, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  getInvoiceStatusLabel,
  getInvoiceStatusVariant,
  matchesInvoiceStatusFilter,
  type InvoiceStatus,
  type InvoiceStatusFilter,
} from '@/lib/invoice-status'

export default function AdminInvoicesPage() {
  const params = useParams()
  const router = useRouter()
  const cohortSlug = params.cohortSlug as string
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('all')

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const startups = useQuery(api.startups.list, cohort ? { cohortId: cohort._id } : 'skip')
  const allInvoices = useQuery(api.invoices.listForAdmin, {})

  // Build a startup ID set and name lookup for this cohort
  const startupIdSet = useMemo(() => {
    if (!startups) return new Set<string>()
    return new Set(startups.map((s) => s._id))
  }, [startups])

  const startupNameMap = useMemo(() => {
    if (!startups) return new Map<string, string>()
    return new Map(startups.map((s) => [s._id, s.name]))
  }, [startups])

  // Filter invoices to only those belonging to startups in this cohort
  const cohortInvoices = useMemo(() => {
    if (!allInvoices || !startups) return undefined
    const filtered = allInvoices.filter((invoice) => startupIdSet.has(invoice.startupId))
    // Sort: submitted/under_review first, then by creation time desc
    filtered.sort((a, b) => {
      const aPending = a.status === 'submitted' || a.status === 'under_review' ? 0 : 1
      const bPending = b.status === 'submitted' || b.status === 'under_review' ? 0 : 1
      if (aPending !== bPending) return aPending - bPending
      return b._creationTime - a._creationTime
    })
    return filtered.slice(0, 50)
  }, [allInvoices, startups, startupIdSet])

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const invoices = useMemo(() => {
    if (!cohortInvoices) return undefined
    return cohortInvoices.filter((invoice) => {
      const status = invoice.status as InvoiceStatus
      const startupName = startupNameMap.get(invoice.startupId) ?? ''
      const matchesSearch =
        normalizedQuery.length === 0 ||
        invoice.vendorName.toLowerCase().includes(normalizedQuery) ||
        (invoice.fileName || '').toLowerCase().includes(normalizedQuery) ||
        startupName.toLowerCase().includes(normalizedQuery)
      const matchesStatus = matchesInvoiceStatusFilter(status, statusFilter)
      return matchesSearch && matchesStatus
    })
  }, [cohortInvoices, normalizedQuery, startupNameMap, statusFilter])

  const isLoading = cohort === undefined || startups === undefined || allInvoices === undefined

  // Redirect if cohort not found (returned null)
  if (cohort === null) {
    router.push('/admin/cohorts')
    return null
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // If no startups, show empty state with call to action
  if (startups.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Invoice Review</h1>
          <p className="text-muted-foreground">
            Review and approve startup expense reimbursements for {cohort.label}
          </p>
        </div>

        {/* Empty State */}
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No startups enrolled"
          description="There are no startups enrolled in this cohort yet. Invite startups to get started with invoice submissions."
          action={
            <Link href={`/admin/${cohortSlug}/startups`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                View Startups
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  const pendingCount =
    cohortInvoices?.filter((i) => i.status === 'submitted' || i.status === 'under_review').length ||
    0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Invoice Review</h1>
        <p className="text-muted-foreground">
          Review and approve startup expense reimbursements for {cohort.label}
        </p>
      </div>

      <HowItWorks title="How reimbursements work">
        <p>
          <strong className="text-foreground">
            Founders deploy unlocked funding through reimbursements.
          </strong>{' '}
          They submit PDF invoices and receipts for legitimate business expenses. We can only
          approve expenses related to their startup which we deem appropriate and in good faith.
        </p>
        <p>
          <strong className="text-foreground">Naming rules:</strong> Invoices must be named{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
            StartupName Invoice N.pdf
          </code>{' '}
          and receipts{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
            StartupName Receipt N-A.pdf
          </code>
          , <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">N-B.pdf</code> etc.
          Multiple receipts are supported. Founders cannot submit incorrectly named or duplicate
          files — this is enforced before submission to keep Xero clean.
        </p>
        <p>
          Founders cannot submit invoices exceeding their available balance (unlocked minus
          deployed). Larger invoices are preferred as they reduce admin overhead.
        </p>
      </HowItWorks>

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">
                {pendingCount} invoice{pendingCount !== 1 ? 's' : ''} pending review
              </p>
              <p className="text-sm text-amber-700">Review required to process reimbursements</p>
            </div>
          </div>
        </Card>
      )}

      {/* Search + Filter */}
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search startup, vendor, or file"
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
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {invoices && invoices.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Showing {invoices.length} of {cohortInvoices?.length ?? 0} invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Startup</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow
                    key={invoice._id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => router.push(`/admin/${cohortSlug}/invoices/${invoice._id}`)}
                  >
                    <TableCell className="font-medium">
                      {startupNameMap.get(invoice.startupId) || 'Unknown'}
                    </TableCell>
                    <TableCell>{invoice.vendorName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(invoice.invoiceDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      £{Number(invoice.amountGbp).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getInvoiceStatusVariant(invoice.status as InvoiceStatus)}>
                        {getInvoiceStatusLabel(invoice.status as InvoiceStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/admin/${cohortSlug}/invoices/${invoice._id}`)
                        }}
                      >
                        Review
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={
            (cohortInvoices?.length ?? 0) > 0 ? 'No invoices match your filters' : 'No invoices yet'
          }
          description={
            (cohortInvoices?.length ?? 0) > 0
              ? 'Try adjusting the search term or selected state.'
              : 'Invoices submitted by startups in this cohort will appear here for review.'
          }
        />
      )}
    </div>
  )
}
