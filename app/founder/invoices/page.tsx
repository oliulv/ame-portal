import { createClient } from '@/lib/supabase/server'
import { getFounderStartupIds } from '@/lib/auth'
import Link from 'next/link'

export default async function FounderInvoicesPage() {
  const startupIds = await getFounderStartupIds()
  const supabase = await createClient()

  if (startupIds.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Invoices</h1>
        <p>No startup associated with your account.</p>
      </div>
    )
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .in('startup_id', startupIds)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Link
          href="/founder/invoices/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Upload Invoice
        </Link>
      </div>

      {invoices && invoices.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.vendor_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(invoice.invoice_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    £{Number(invoice.amount_gbp).toFixed(2)}
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
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <p className="text-gray-500 mb-4">No invoices yet.</p>
          <Link
            href="/founder/invoices/new"
            className="text-blue-600 hover:underline"
          >
            Upload your first invoice
          </Link>
        </div>
      )}
    </div>
  )
}

