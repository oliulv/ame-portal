import { internalMutation, internalAction, internalQuery } from './functions'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'

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

    // Collect all receipt storage IDs and filenames
    const allReceiptStorageIds: string[] = []
    const allReceiptFileNames: string[] = []

    for (const inv of componentInvoices) {
      // Include the original invoice files as receipts too
      allReceiptStorageIds.push(inv.storageId)
      allReceiptFileNames.push(inv.fileName)

      // Include actual receipts
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

    // Generate batch invoice PDF using pdf-lib
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const page = pdfDoc.addPage([595, 842]) // A4
    const { height } = page.getSize()

    let y = height - 50

    // Header
    page.drawText(startup.name, { x: 50, y, font: boldFont, size: 18, color: rgb(0, 0, 0) })
    y -= 25
    page.drawText(`Combined Invoice ${batchNumber}`, {
      x: 50,
      y,
      font: boldFont,
      size: 14,
      color: rgb(0.3, 0.3, 0.3),
    })
    y -= 20
    page.drawText(`Date: ${new Date().toISOString().split('T')[0]}`, {
      x: 50,
      y,
      font,
      size: 10,
      color: rgb(0.4, 0.4, 0.4),
    })
    y -= 30

    // Line items header
    page.drawText('Vendor', { x: 50, y, font: boldFont, size: 10 })
    page.drawText('Description', { x: 200, y, font: boldFont, size: 10 })
    page.drawText('Amount', { x: 480, y, font: boldFont, size: 10 })
    y -= 5
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5 })
    y -= 15

    // Line items
    for (const inv of componentInvoices) {
      if (y < 80) {
        // Add a new page if needed
        const newPage = pdfDoc.addPage([595, 842])
        y = newPage.getSize().height - 50
        // Draw on new page would need a reference; for simplicity, keep on one page
        break
      }
      const vendorText =
        inv.vendorName.length > 20 ? inv.vendorName.slice(0, 20) + '...' : inv.vendorName
      const descText =
        (inv.description || 'N/A').length > 35
          ? (inv.description || 'N/A').slice(0, 35) + '...'
          : inv.description || 'N/A'
      page.drawText(vendorText, { x: 50, y, font, size: 9 })
      page.drawText(descText, { x: 200, y, font, size: 9 })
      page.drawText(`£${inv.amountGbp.toFixed(2)}`, { x: 480, y, font, size: 9 })
      y -= 18
    }

    // Total
    y -= 5
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5 })
    y -= 15
    page.drawText('TOTAL', { x: 50, y, font: boldFont, size: 11 })
    page.drawText(`£${totalAmount.toFixed(2)}`, { x: 480, y, font: boldFont, size: 11 })

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
