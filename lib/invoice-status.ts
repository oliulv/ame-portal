export type InvoiceStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid'

export type InvoiceStatusFilter = 'all' | 'pending' | InvoiceStatus

export function getInvoiceStatusVariant(
  status: string
): 'success' | 'warning' | 'danger' | 'info' | 'secondary' {
  switch (status) {
    case 'approved':
      return 'success'
    case 'rejected':
      return 'danger'
    case 'paid':
      return 'info'
    case 'submitted':
    case 'under_review':
      return 'warning'
    default:
      return 'secondary'
  }
}

export function getInvoiceStatusLabel(status: string): string {
  switch (status) {
    case 'under_review':
      return 'Under Review'
    case 'submitted':
      return 'Submitted'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    case 'paid':
      return 'Paid'
    default:
      return status.replace('_', ' ')
  }
}

export function matchesInvoiceStatusFilter(
  status: InvoiceStatus,
  filter: InvoiceStatusFilter
): boolean {
  if (filter === 'all') return true
  if (filter === 'pending') return status === 'submitted' || status === 'under_review'
  return status === filter
}
