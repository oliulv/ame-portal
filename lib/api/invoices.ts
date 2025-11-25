import { apiClient } from './client'
import { Invoice } from '@/lib/types'

export interface FounderInvoicesResponse {
  invoices: Invoice[]
  pendingCount: number
}

export const invoicesApi = {
  /**
   * Fetch invoices for the founder's startup
   */
  getFounderInvoices: async (): Promise<FounderInvoicesResponse> => {
    return apiClient.get<FounderInvoicesResponse>('/api/founder/invoices')
  },
}
