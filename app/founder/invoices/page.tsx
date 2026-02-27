'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function FounderInvoicesPage() {
  const invoicesData = useQuery(api.invoices.listForFounder)
  const fundingSummary = useQuery(api.milestones.fundingSummaryForFounder)

  if (invoicesData === undefined || fundingSummary === undefined) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Invoices</h1>
        </div>
        <div className="bg-card p-6 rounded-lg border text-center">
          <p className="text-muted-foreground">Loading invoices...</p>
        </div>
      </div>
    )
  }

  const invoices = invoicesData.invoices ?? []
  const canUpload = fundingSummary.available > 0

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        {canUpload ? (
          <Link href="/founder/invoices/new">
            <Button>Upload Invoice</Button>
          </Link>
        ) : (
          <Button disabled>Upload Invoice</Button>
        )}
      </div>

      {!canUpload && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">No available balance</p>
            <p className="text-sm text-amber-700 mt-0.5">
              {fundingSummary.hasMilestones
                ? 'All unlocked funds have been deployed. Complete more milestones to unlock additional funding.'
                : 'No milestones have been set up yet. Contact your program admin for more information.'}
            </p>
            <Link href="/founder/funding" className="text-sm font-medium text-amber-900 hover:underline mt-1 inline-block">
              View funding details →
            </Link>
          </div>
        </div>
      )}

      {invoices.length > 0 ? (
        <div className="bg-card rounded-lg border overflow-hidden">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {invoices.map((invoice) => (
                <tr key={invoice._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                    {invoice.vendorName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(invoice.invoiceDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {Number(invoice.amountGbp).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        invoice.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : invoice.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : invoice.status === 'paid'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {invoice.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card p-6 rounded-lg border text-center">
          <p className="text-muted-foreground mb-4">No invoices yet.</p>
          <Link href="/founder/invoices/new" className="text-primary hover:underline">
            Upload your first invoice
          </Link>
        </div>
      )}
    </div>
  )
}
