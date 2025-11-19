import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileText, AlertCircle, ExternalLink } from 'lucide-react'

function getInvoiceStatusVariant(status: string): "success" | "warning" | "destructive" | "info" | "secondary" {
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

export default async function AdminInvoicesPage() {
  const supabase = await createClient()
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, startups(id, name)')
    .order('created_at', { ascending: false })
    .limit(50)

  const pendingCount = invoices?.filter(i => i.status === 'submitted' || i.status === 'under_review').length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invoice Review</h1>
        <p className="text-muted-foreground">
          Review and approve startup expense reimbursements
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
              <p className="text-sm text-amber-700">
                Review required to process reimbursements
              </p>
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    {invoice.startups?.name || 'Unknown'}
                  </TableCell>
                  <TableCell>{invoice.vendor_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(invoice.invoice_date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    £{Number(invoice.amount_gbp).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getInvoiceStatusVariant(invoice.status)}>
                      {invoice.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/invoices/${invoice.id}`}>
                      <Button variant="ghost" size="sm">
                        Review
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Button>
                    </Link>
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
          description="Invoices submitted by startups will appear here for review."
        />
      )}
    </div>
  )
}

