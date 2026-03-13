import { internalMutation, internalAction, internalQuery, query, mutation } from './functions'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { requireAdmin } from './auth'

/**
 * Schedule (or reschedule) a batch for a startup.
 * 5-minute debounce: if a pending batch exists, cancel and reschedule.
 */
export const scheduleBatching = internalMutation({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    // Check for existing pending batch
    const existing = await ctx.db
      .query('pendingBatches')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .first()

    if (existing) {
      await ctx.scheduler.cancel(existing.scheduledFnId)
      await ctx.db.delete(existing._id)
    }

    // Schedule new batch execution in 5 minutes
    const scheduledFnId = await ctx.scheduler.runAfter(
      5 * 60 * 1000,
      internal.invoiceBatching.executeBatch,
      { startupId: args.startupId }
    )

    await ctx.db.insert('pendingBatches', {
      startupId: args.startupId,
      scheduledFnId,
    })
  },
})

/**
 * Cancel pending batch if approval empties the submitted queue.
 */
export const cancelBatchIfEmpty = internalMutation({
  args: {
    startupId: v.id('startups'),
    excludeInvoiceId: v.id('invoices'),
  },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query('invoices')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()

    const remaining = invoices.filter(
      (i) => i.status === 'submitted' && i._id !== args.excludeInvoiceId && !i.batchedIntoId
    )

    if (remaining.length <= 1) {
      const pending = await ctx.db
        .query('pendingBatches')
        .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
        .first()
      if (pending) {
        await ctx.scheduler.cancel(pending.scheduledFnId)
        await ctx.db.delete(pending._id)
      }
    }
  },
})

/**
 * Get pending batch info for admin UI.
 */
export const getPendingBatch = query({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const pending = await ctx.db
      .query('pendingBatches')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .first()
    if (!pending) return null
    const scheduledFn = await ctx.db.system.get(pending.scheduledFnId)
    return { scheduledTime: scheduledFn?.scheduledTime ?? null }
  },
})

/**
 * Trigger batch execution immediately (admin action).
 */
export const triggerBatchNow = mutation({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const pending = await ctx.db
      .query('pendingBatches')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .first()
    if (!pending) throw new Error('No pending batch found')
    await ctx.scheduler.cancel(pending.scheduledFnId)
    await ctx.db.delete(pending._id)
    await ctx.scheduler.runAfter(0, internal.invoiceBatching.executeBatch, {
      startupId: args.startupId,
    })
  },
})

/**
 * Fallback context for batch PDF when AI extraction fails.
 */
export const getBatchContext = internalQuery({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    const bankDetails = await ctx.db
      .query('bankDetails')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .first()
    const founderProfile = await ctx.db
      .query('founderProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .first()
    return { bankDetails, founderProfile }
  },
})

/**
 * Execute batch: combine all submitted invoices for a startup into one.
 */
export const executeBatch = internalAction({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    // Clean up pendingBatches record
    await ctx.runMutation(internal.invoiceBatching.cleanupPendingBatch, {
      startupId: args.startupId,
    })

    // Get all submitted invoices for this startup
    const invoicesData = await ctx.runQuery(internal.invoiceBatching.getSubmittedInvoices, {
      startupId: args.startupId,
    })

    if (!invoicesData || invoicesData.invoices.length <= 1) {
      return // Nothing to batch
    }

    const { invoices, startup } = invoicesData

    // Unpack existing batch invoices and collect all component invoices
    const componentInvoices: typeof invoices = []
    const batchInvoicesToDelete: Id<'invoices'>[] = []

    for (const inv of invoices) {
      if (inv.isBatched && inv.batchedFromIds) {
        // This is an existing batch — unpack it
        batchInvoicesToDelete.push(inv._id)
        const components = await ctx.runQuery(internal.invoiceBatching.getInvoicesByIds, {
          ids: inv.batchedFromIds,
        })
        componentInvoices.push(...components)
      } else {
        componentInvoices.push(inv)
      }
    }

    if (componentInvoices.length <= 1) return

    // Separate original invoice files from actual receipts
    const allOriginalInvoiceStorageIds: string[] = []
    const allOriginalInvoiceFileNames: string[] = []
    const allReceiptStorageIds: string[] = []
    const allReceiptFileNames: string[] = []

    for (const inv of componentInvoices) {
      // Original invoice files go in their own array
      allOriginalInvoiceStorageIds.push(inv.storageId)
      allOriginalInvoiceFileNames.push(inv.fileName)

      // Actual receipts stay separate
      const rIds = inv.receiptStorageIds ?? (inv.receiptStorageId ? [inv.receiptStorageId] : [])
      const rNames = inv.receiptFileNames ?? (inv.receiptFileName ? [inv.receiptFileName] : [])
      allReceiptStorageIds.push(...rIds)
      allReceiptFileNames.push(...rNames)
    }

    // Programmatic math: sum all amounts
    const totalAmount = componentInvoices.reduce((sum, inv) => sum + inv.amountGbp, 0)

    // Find smallest invoice number for the batch
    const invoiceNumbers = componentInvoices
      .map((inv) => {
        const match = inv.fileName.match(/Invoice (\d+)\.pdf$/i)
        return match ? parseInt(match[1], 10) : 999999
      })
      .sort((a, b) => a - b)
    const batchNumber = invoiceNumbers[0]

    // Build combined vendor names and description
    const vendorNames = [...new Set(componentInvoices.map((inv) => inv.vendorName))].join(', ')
    const description = componentInvoices
      .map((inv) => `${inv.vendorName}: ${inv.description || 'N/A'} (£${inv.amountGbp.toFixed(2)})`)
      .join('\n')

    // Try AI extraction for company metadata from first component invoice
    let metadata: {
      companyName: string
      addressLines: string[]
      email: string | null
      phone: string | null
      bankDetails: {
        accountHolder: string
        sortCode: string
        accountNumber: string
        bankName: string | null
      } | null
      billTo: { name: string; addressLines: string[] } | null
    } | null = null

    try {
      metadata = await ctx.runAction(internal.ai.extractInvoiceMetadata, {
        invoiceStorageId: componentInvoices[0].storageId,
      })
    } catch {
      // AI extraction failed, will use DB fallback
    }

    // DB fallback data
    const batchContext = await ctx.runQuery(internal.invoiceBatching.getBatchContext, {
      startupId: args.startupId,
    })

    // Generate batch invoice PDF using pdf-lib
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const pageWidth = 595
    const pageHeight = 842
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
    let y = pageHeight - 50

    function ensureSpace(needed: number) {
      if (y < needed) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight])
        y = pageHeight - 50
      }
    }

    // Header: Company name
    const companyName = metadata?.companyName || startup.name
    currentPage.drawText(companyName, {
      x: 50,
      y,
      font: boldFont,
      size: 18,
      color: rgb(0, 0, 0),
    })
    y -= 20

    // Address lines
    const addressLines =
      metadata?.addressLines ??
      [
        batchContext.founderProfile?.addressLine1,
        batchContext.founderProfile?.addressLine2,
        [batchContext.founderProfile?.city, batchContext.founderProfile?.postcode]
          .filter(Boolean)
          .join(' '),
        batchContext.founderProfile?.country,
      ].filter(Boolean)

    for (const line of addressLines) {
      if (!line) continue
      currentPage.drawText(line, { x: 50, y, font, size: 9, color: rgb(0.3, 0.3, 0.3) })
      y -= 13
    }

    // Contact info
    if (metadata?.email || metadata?.phone) {
      y -= 2
      const contactParts = [metadata.email, metadata.phone].filter(Boolean)
      currentPage.drawText(contactParts.join(' | '), {
        x: 50,
        y,
        font,
        size: 8,
        color: rgb(0.4, 0.4, 0.4),
      })
      y -= 18
    } else {
      y -= 10
    }

    // Invoice title — right-aligned
    const invoiceTitle = `COMBINED INVOICE ${batchNumber}`
    const titleWidth = boldFont.widthOfTextAtSize(invoiceTitle, 14)
    currentPage.drawText(invoiceTitle, {
      x: pageWidth - 50 - titleWidth,
      y,
      font: boldFont,
      size: 14,
      color: rgb(0.2, 0.2, 0.2),
    })
    y -= 18

    // Date — right-aligned
    const dateStr = `Date: ${new Date().toISOString().split('T')[0]}`
    const dateWidth = font.widthOfTextAtSize(dateStr, 10)
    currentPage.drawText(dateStr, {
      x: pageWidth - 50 - dateWidth,
      y,
      font,
      size: 10,
      color: rgb(0.4, 0.4, 0.4),
    })
    y -= 25

    // Bill To
    const billToName = metadata?.billTo?.name ?? 'Accelerate ME'
    const billToAddress = metadata?.billTo?.addressLines ?? []
    currentPage.drawText('Bill To:', { x: 50, y, font: boldFont, size: 10, color: rgb(0, 0, 0) })
    y -= 14
    currentPage.drawText(billToName, { x: 50, y, font, size: 10, color: rgb(0.2, 0.2, 0.2) })
    y -= 13
    for (const line of billToAddress) {
      currentPage.drawText(line, { x: 50, y, font, size: 9, color: rgb(0.3, 0.3, 0.3) })
      y -= 13
    }
    y -= 15

    // Line items header
    currentPage.drawText('Vendor', { x: 50, y, font: boldFont, size: 10 })
    currentPage.drawText('Description', { x: 200, y, font: boldFont, size: 10 })
    currentPage.drawText('Amount', { x: 480, y, font: boldFont, size: 10 })
    y -= 5
    currentPage.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 0.5,
      color: rgb(0.3, 0.3, 0.3),
    })
    y -= 15

    // Line items
    for (const inv of componentInvoices) {
      ensureSpace(80)
      const vendorText =
        inv.vendorName.length > 20 ? inv.vendorName.slice(0, 20) + '...' : inv.vendorName
      const descText =
        (inv.description || 'N/A').length > 35
          ? (inv.description || 'N/A').slice(0, 35) + '...'
          : inv.description || 'N/A'
      currentPage.drawText(vendorText, { x: 50, y, font, size: 9 })
      currentPage.drawText(descText, { x: 200, y, font, size: 9 })
      currentPage.drawText(`£${inv.amountGbp.toFixed(2)}`, { x: 480, y, font, size: 9 })
      y -= 18
    }

    // Total
    ensureSpace(60)
    y -= 5
    currentPage.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 1,
      color: rgb(0, 0, 0),
    })
    y -= 18
    currentPage.drawText('TOTAL', { x: 50, y, font: boldFont, size: 11 })
    currentPage.drawText(`£${totalAmount.toFixed(2)}`, { x: 480, y, font: boldFont, size: 11 })

    // Bank details section
    const bankInfo =
      (metadata?.bankDetails ?? batchContext.bankDetails)
        ? {
            accountHolder:
              metadata?.bankDetails?.accountHolder ??
              batchContext.bankDetails?.accountHolderName ??
              '',
            sortCode: metadata?.bankDetails?.sortCode ?? batchContext.bankDetails?.sortCode ?? '',
            accountNumber:
              metadata?.bankDetails?.accountNumber ?? batchContext.bankDetails?.accountNumber ?? '',
            bankName: metadata?.bankDetails?.bankName ?? batchContext.bankDetails?.bankName ?? null,
          }
        : null

    if (bankInfo && bankInfo.accountHolder) {
      ensureSpace(100)
      y -= 30
      currentPage.drawText('Bank Details', {
        x: 50,
        y,
        font: boldFont,
        size: 10,
        color: rgb(0, 0, 0),
      })
      y -= 15
      currentPage.drawText(`Account Holder: ${bankInfo.accountHolder}`, {
        x: 50,
        y,
        font,
        size: 9,
        color: rgb(0.3, 0.3, 0.3),
      })
      y -= 13
      currentPage.drawText(`Sort Code: ${bankInfo.sortCode}`, {
        x: 50,
        y,
        font,
        size: 9,
        color: rgb(0.3, 0.3, 0.3),
      })
      y -= 13
      currentPage.drawText(`Account Number: ${bankInfo.accountNumber}`, {
        x: 50,
        y,
        font,
        size: 9,
        color: rgb(0.3, 0.3, 0.3),
      })
      if (bankInfo.bankName) {
        y -= 13
        currentPage.drawText(`Bank: ${bankInfo.bankName}`, {
          x: 50,
          y,
          font,
          size: 9,
          color: rgb(0.3, 0.3, 0.3),
        })
      }
    }

    const pdfBytes = await pdfDoc.save()

    // Upload the generated PDF to Convex storage
    const batchFileName = `${startup.name} Invoice ${batchNumber}.pdf`
    const uploadUrl = await ctx.storage.generateUploadUrl()
    const pdfBlob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
    const uploadResult = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: pdfBlob,
    })
    if (!uploadResult.ok) throw new Error('Failed to upload batch invoice PDF')
    const { storageId: batchStorageId } = await uploadResult.json()

    // Create the batch invoice and update component invoices
    await ctx.runMutation(internal.invoiceBatching.updateBatchedInvoice, {
      startupId: args.startupId,
      uploadedByUserId: componentInvoices[0].uploadedByUserId,
      vendorName: vendorNames,
      description,
      invoiceDate: new Date().toISOString().split('T')[0],
      amountGbp: totalAmount,
      storageId: batchStorageId,
      fileName: batchFileName,
      receiptStorageIds: allReceiptStorageIds,
      receiptFileNames: allReceiptFileNames,
      originalInvoiceStorageIds: allOriginalInvoiceStorageIds,
      originalInvoiceFileNames: allOriginalInvoiceFileNames,
      componentIds: componentInvoices.map((inv) => inv._id),
      batchInvoicesToDelete,
    })
  },
})

/**
 * Helper: clean up pendingBatches record.
 */
export const cleanupPendingBatch = internalMutation({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pendingBatches')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .first()
    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})

/**
 * Helper: get all submitted invoices for a startup.
 */
export const getSubmittedInvoices = internalQuery({
  args: { startupId: v.id('startups') },
  handler: async (ctx, args) => {
    const startup = await ctx.db.get(args.startupId)
    if (!startup) return null

    const invoices = await ctx.db
      .query('invoices')
      .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId))
      .collect()

    const submitted = invoices.filter((i) => i.status === 'submitted' && !i.batchedIntoId)

    return { invoices: submitted, startup }
  },
})

/**
 * Helper: get invoices by IDs.
 */
export const getInvoicesByIds = internalQuery({
  args: { ids: v.array(v.id('invoices')) },
  handler: async (ctx, args) => {
    const results = []
    for (const id of args.ids) {
      const inv = await ctx.db.get(id)
      if (inv) results.push(inv)
    }
    return results
  },
})

/**
 * Helper: create the batch invoice and mark components.
 */
export const updateBatchedInvoice = internalMutation({
  args: {
    startupId: v.id('startups'),
    uploadedByUserId: v.id('users'),
    vendorName: v.string(),
    description: v.string(),
    invoiceDate: v.string(),
    amountGbp: v.number(),
    storageId: v.string(),
    fileName: v.string(),
    receiptStorageIds: v.array(v.string()),
    receiptFileNames: v.array(v.string()),
    originalInvoiceStorageIds: v.array(v.string()),
    originalInvoiceFileNames: v.array(v.string()),
    componentIds: v.array(v.id('invoices')),
    batchInvoicesToDelete: v.array(v.id('invoices')),
  },
  handler: async (ctx, args) => {
    // Delete old batch invoices that are being replaced
    for (const oldBatchId of args.batchInvoicesToDelete) {
      await ctx.db.delete(oldBatchId)
    }

    // Create the batch invoice
    const batchId = await ctx.db.insert('invoices', {
      startupId: args.startupId,
      uploadedByUserId: args.uploadedByUserId,
      vendorName: args.vendorName,
      invoiceDate: args.invoiceDate,
      amountGbp: args.amountGbp,
      description: args.description,
      storageId: args.storageId as Id<'_storage'>,
      fileName: args.fileName,
      receiptStorageIds: args.receiptStorageIds as Id<'_storage'>[],
      receiptFileNames: args.receiptFileNames,
      receiptStorageId: args.receiptStorageIds[0] as Id<'_storage'>,
      receiptFileName: args.receiptFileNames[0],
      originalInvoiceStorageIds: args.originalInvoiceStorageIds as Id<'_storage'>[],
      originalInvoiceFileNames: args.originalInvoiceFileNames,
      status: 'submitted',
      isBatched: true,
      batchedFromIds: args.componentIds,
    })

    // Mark all component invoices as batched
    for (const componentId of args.componentIds) {
      await ctx.db.patch(componentId, { batchedIntoId: batchId })
    }
  },
})
