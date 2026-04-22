/**
 * Whitelist check: is `storageId` actually referenced by this invoice?
 * Used to prevent handing out signed URLs for storage IDs that do not
 * belong to the invoice identified in the same call.
 */
export function isStorageIdOnInvoice(
  invoice: {
    storageId: string
    receiptStorageId?: string
    receiptStorageIds?: string[]
    originalInvoiceStorageIds?: string[]
  },
  storageId: string
): boolean {
  if (invoice.storageId === storageId) return true
  if (invoice.receiptStorageId && invoice.receiptStorageId === storageId) return true
  if (invoice.receiptStorageIds?.includes(storageId)) return true
  if (invoice.originalInvoiceStorageIds?.includes(storageId)) return true
  return false
}
