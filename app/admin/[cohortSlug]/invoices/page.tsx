'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileText, AlertCircle, ExternalLink, Users, Plus } from 'lucide-react'
import { useMemo } from 'react'

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

export default function AdminInvoicesPage() {
  const params = useParams()
  const router = useRouter()
  const cohortSlug = params.cohortSlug as string

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
  const invoices = useMemo(() => {
    if (!allInvoices || !startups) return undefined
    return allInvoices.filter((invoice) => startupIdSet.has(invoice.startupId)).slice(0, 50)
  }, [allInvoices, startups, startupIdSet])

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
          <h1 className="text-3xl font-bold tracking-tight">Invoice Review</h1>
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
    invoices?.filter((i) => i.status === 'submitted' || i.status === 'under_review').length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invoice Review</h1>
        <p className="text-muted-foreground">
          Review and approve startup expense reimbursements for {cohort.label}
        </p>
      </div>

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

      {/* Table */}
      {invoices && invoices.length > 0 ? (
        <Card>
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
                    <Badge variant={getInvoiceStatusVariant(invoice.status)}>
                      {invoice.status.replace('_', ' ')}
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
        </Card>
      ) : (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No invoices yet"
          description="Invoices submitted by startups in this cohort will appear here for review."
        />
      )}
    </div>
  )
}
