import { query, mutation, internalAction, internalQuery, enrichEvent } from './functions'
import { internal } from './_generated/api'
import { v, ConvexError } from 'convex/values'
import type { Id } from './_generated/dataModel'
import {
  requireAdmin,
  requireAdminWithPermission,
  requireFounder,
  requireAuth,
  getFounderStartupIds,
} from './auth'
import { validateInvoiceFileName, extractInvoiceNumber } from './invoiceValidation'
import {
  isValidTransition,
  computeNextInvoiceNumber,
  computeAvailableBalance,
} from './lib/invoiceLogic'

/**
 * Generate a pre-signed upload URL for invoice files.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Delete a stored file (cleanup for cancelled uploads).
 */
export const deleteStorageFile = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    await requireAuth(ctx)
    await ctx.storage.delete(args.storageId)
  },
})

/**
 * Get a URL for a stored file.
 */
export const getFileUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId)
  },
})

/**
 * Create an invoice record (founder uploads file, then creates record).
 * Validates: PDF only, naming convention, amount within available balance.
 */
export const create = mutation({
  args: {
    storageId: v.id('_storage'),
    fileName: v.string(),
    vendorName: v.string(),
    invoiceDate: v.string(),
    amountGbp: v.number(),
    description: v.optional(v.string()),
    receiptStorageIds: v.array(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    // Enrich wide event with business context
    enrichEvent(ctx, { userId: user._id, fileName: args.fileName, amountGbp: args.amountGbp })

    if (startupIds.length === 0) {
      throw new ConvexError('No startup associated with your account')
    }

    const startupId = startupIds[0]
    const startup = await ctx.db.get(startupId)
    if (!startup) throw new ConvexError('Startup not found')

    enrichEvent(ctx, { startupId, startupName: startup.name })

    // Validate at least one receipt
    if (args.receiptStorageIds.length === 0) {
      throw new ConvexError('At least one receipt is required')
    }

    // Validate filename format and naming convention
    const nameValidation = validateInvoiceFileName(args.fileName, startup.name)
    if (!nameValidation.valid) {
      throw new ConvexError(nameValidation.error)
    }

    // Enforce sequential invoice numbering (rejected and batched-into invoices don't count)
    const existingInvoices = await ctx.db
      .query('invoices')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
      .collect()

    const expectedNext = computeNextInvoiceNumber(existingInvoices)

    const invoiceNum = extractInvoiceNumber(args.fileName)
    if (!invoiceNum || invoiceNum !== expectedNext) {
      throw new ConvexError(
        `Invoice number must be ${expectedNext}. Please name your file "${startup.name} Invoice ${expectedNext}.pdf".`
      )
    }

    // Generate structured receipt filenames server-side
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const receiptFileNames =
      args.receiptStorageIds.length === 1
        ? [`${startup.name} Receipt ${expectedNext}.pdf`]
        : args.receiptStorageIds.map(
            (_, i) => `${startup.name} Receipt ${expectedNext}-${letters[i]}.pdf`
          )

    // Validate amount against available balance (exclude batched-into invoices to avoid double-counting)
    const milestones = await ctx.db
      .query('milestones')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
      .collect()
    const unlockedAmounts = milestones.filter((m) => m.status === 'approved').map((m) => m.amount)
    const deployedAmounts = existingInvoices
      .filter((i) => i.status === 'paid' && !i.batchedIntoId)
      .map((i) => i.amountGbp)
    const available = computeAvailableBalance(unlockedAmounts, deployedAmounts)

    if (available <= 0) {
      throw new ConvexError(
        'No available funding. Complete milestones to unlock funding before submitting invoices.'
      )
    }
    if (args.amountGbp > available) {
      throw new ConvexError(
        `Amount exceeds available balance. You have £${available.toFixed(2)} available.`
      )
    }

    const invoiceId = await ctx.db.insert('invoices', {
      startupId,
      uploadedByUserId: user._id,
      vendorName: args.vendorName,
      invoiceDate: args.invoiceDate,
      amountGbp: args.amountGbp,
      description: args.description,
      storageId: args.storageId,
      fileName: args.fileName,
      // Array fields for multiple receipts
      receiptStorageIds: args.receiptStorageIds,
      receiptFileNames,
      // Backward compat: first receipt in legacy fields
      receiptStorageId: args.receiptStorageIds[0],
      receiptFileName: receiptFileNames[0],
      status: 'submitted',
    })

    // Schedule auto-batching (5-min debounce)
    await ctx.scheduler.runAfter(0, internal.invoiceBatching.scheduleBatching, { startupId })

    // Notify admins about new invoice submission
    await ctx.scheduler.runAfter(0, internal.notifications.notifyInvoiceSubmitted, {
      cohortId: startup.cohortId,
      startupName: startup.name,
      vendorName: args.vendorName,
      amountGbp: args.amountGbp,
    })

    return invoiceId
  },
})

/**
 * Get the founder's startup name and the expected next invoice number.
 */
export const getFounderInvoiceInfo = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) return null
    const startup = await ctx.db.get(startupIds[0])
    if (!startup) return null

    const invoices = await ctx.db
      .query('invoices')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupIds[0]))
      .collect()

    return {
      startupName: startup.name,
      nextInvoiceNumber: computeNextInvoiceNumber(invoices),
    }
  },
})

/**
 * List invoices for the current founder.
 */
export const listForFounder = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    if (startupIds.length === 0) {
      return { invoices: [], pendingCount: 0 }
    }

    const allInvoices = []
    for (const startupId of startupIds) {
      const invoices = await ctx.db
        .query('invoices')
        .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
        .collect()
      allInvoices.push(...invoices)
    }

    // Filter out invoices that have been absorbed into a batch
    const visibleInvoices = allInvoices.filter((i) => !i.batchedIntoId)

    // Sort newest first
    visibleInvoices.sort((a, b) => b._creationTime - a._creationTime)

    const pendingCount = visibleInvoices.filter(
      (i) => i.status === 'submitted' || i.status === 'under_review'
    ).length

    return { invoices: visibleInvoices, pendingCount }
  },
})

/**
 * List all invoices (admin view), optionally filtered by startup or status.
 */
export const listForAdmin = query({
  args: {
    startupId: v.optional(v.id('startups')),
    status: v.optional(
      v.union(
        v.literal('submitted'),
        v.literal('under_review'),
        v.literal('approved'),
        v.literal('rejected'),
        v.literal('paid')
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    let invoices

    if (args.startupId) {
      invoices = await ctx.db
        .query('invoices')
        .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId!))
        .collect()
    } else if (args.status) {
      invoices = await ctx.db
        .query('invoices')
        .withIndex('by_status', (q) => q.eq('status', args.status!))
        .collect()
    } else {
      invoices = await ctx.db.query('invoices').collect()
    }

    // Apply both filters if needed
    if (args.startupId && args.status) {
      invoices = invoices.filter((i) => i.status === args.status)
    }

    // Filter out invoices absorbed into a batch
    invoices = invoices.filter((i) => !i.batchedIntoId)

    invoices.sort((a, b) => b._creationTime - a._creationTime)

    const enriched = await Promise.all(
      invoices.map(async (inv) => {
        const startup = await ctx.db.get(inv.startupId)
        return { ...inv, startupName: startup?.name }
      })
    )
    return enriched
  },
})

/**
 * Get the next submitted invoice (for auto-navigation after approval).
 * If startupId is provided, looks within that startup first.
 * Otherwise finds the next submitted invoice across all startups in the cohort.
 */
export const getNextSubmitted = query({
  args: {
    cohortId: v.id('cohorts'),
    excludeId: v.id('invoices'),
    startupId: v.optional(v.id('startups')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    if (args.startupId) {
      // Find next submitted invoice for this specific startup
      const invoices = await ctx.db
        .query('invoices')
        .withIndex('by_startupId', (q) => q.eq('startupId', args.startupId!))
        .collect()
      const next = invoices
        .filter((i) => i.status === 'submitted' && i._id !== args.excludeId && !i.batchedIntoId)
        .sort((a, b) => a._creationTime - b._creationTime)
      if (next.length > 0) return next[0]._id
    }

    // Find next submitted invoice across all startups in the cohort
    const startups = await ctx.db
      .query('startups')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const candidates = []
    for (const startup of startups) {
      const invoices = await ctx.db
        .query('invoices')
        .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
        .collect()
      candidates.push(
        ...invoices.filter(
          (i) => i.status === 'submitted' && i._id !== args.excludeId && !i.batchedIntoId
        )
      )
    }
    candidates.sort((a, b) => a._creationTime - b._creationTime)
    return candidates.length > 0 ? candidates[0]._id : null
  },
})

/**
 * Get a single invoice by ID.
 */
export const getById = query({
  args: { id: v.id('invoices') },
  handler: async (ctx, args) => {
    await requireAuth(ctx)
    return await ctx.db.get(args.id)
  },
})

/**
 * Update invoice status (admin: approve, reject, mark paid).
 */
export const updateStatus = mutation({
  args: {
    id: v.id('invoices'),
    status: v.union(
      v.literal('under_review'),
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('paid')
    ),
    adminComment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.id)
    if (!invoice) throw new Error('Invoice not found')

    // Permission gating: approved/rejected require approve_invoices permission
    const startup = await ctx.db.get(invoice.startupId)
    if (!startup) throw new Error('Startup not found')

    let admin
    if (args.status === 'approved' || args.status === 'rejected') {
      admin = await requireAdminWithPermission(ctx, startup.cohortId, 'approve_invoices')
    } else {
      admin = await requireAdmin(ctx)
    }

    // Validate status transitions
    if (!isValidTransition(invoice.status, args.status)) {
      throw new Error(`Cannot change status from "${invoice.status}" to "${args.status}"`)
    }

    const patch: Record<string, unknown> = {
      status: args.status,
    }

    if (args.adminComment !== undefined) {
      patch.adminComment = args.adminComment?.trim() || undefined
    }

    if (args.status === 'approved') {
      patch.approvedByAdminId = admin._id
      patch.approvedAt = new Date().toISOString()
    }

    if (args.status === 'paid') {
      patch.paidAt = new Date().toISOString()
    }

    await ctx.db.patch(args.id, patch)

    // Send to Xero on approval
    if (args.status === 'approved') {
      await ctx.scheduler.runAfter(0, internal.invoices.sendToXero, { invoiceId: args.id })
      // Cancel pending batch if this approval empties the queue
      await ctx.scheduler.runAfter(0, internal.invoiceBatching.cancelBatchIfEmpty, {
        startupId: invoice.startupId,
        excludeInvoiceId: args.id,
      })
    }

    // Notify founder about invoice status change
    if (args.status === 'approved' || args.status === 'rejected') {
      await ctx.scheduler.runAfter(0, internal.notifications.notifyInvoiceStatusChanged, {
        userId: invoice.uploadedByUserId,
        fileName: invoice.fileName,
        status: args.status,
      })
    }

    // Notify founder when invoice is marked as paid
    if (args.status === 'paid') {
      const startup = await ctx.db.get(invoice.startupId)
      await ctx.scheduler.runAfter(0, internal.notifications.notifyInvoicePaid, {
        userId: invoice.uploadedByUserId,
        fileName: invoice.fileName,
        amountGbp: invoice.amountGbp,
        cohortId: startup?.cohortId,
      })
    }
  },
})

/**
 * Batch mark multiple approved invoices as paid (admin).
 */
export const batchMarkPaid = mutation({
  args: { ids: v.array(v.id('invoices')) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    for (const id of args.ids) {
      const invoice = await ctx.db.get(id)
      if (!invoice) throw new Error(`Invoice ${id} not found`)
      if (invoice.status !== 'approved') throw new Error(`Invoice ${id} is not approved`)
      await ctx.db.patch(id, {
        status: 'paid',
        paidAt: new Date().toISOString(),
      })

      // Notify founder about payment
      const startup = await ctx.db.get(invoice.startupId)
      await ctx.scheduler.runAfter(0, internal.notifications.notifyInvoicePaid, {
        userId: invoice.uploadedByUserId,
        fileName: invoice.fileName,
        amountGbp: invoice.amountGbp,
        cohortId: startup?.cohortId,
      })
    }
  },
})

/**
 * Internal query: get invoice data + startup name for the Xero action.
 */
export const getInvoiceForXero = internalQuery({
  args: { invoiceId: v.id('invoices') },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId)
    if (!invoice) return null
    const startup = await ctx.db.get(invoice.startupId)
    return { invoice, startupName: startup?.name ?? 'Unknown' }
  },
})

/**
 * Internal action: send invoice + receipt PDFs to Xero via Resend email.
 */
export const sendToXero = internalAction({
  args: { invoiceId: v.id('invoices') },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.invoices.getInvoiceForXero, {
      invoiceId: args.invoiceId,
    })
    if (!data) throw new Error('Invoice not found for Xero send')

    const { invoice, startupName } = data
    const xeroBillsEmail = process.env.XERO_BILLS_EMAIL
    const xeroReceiptsEmail = process.env.XERO_RECEIPTS_EMAIL
    const fromEmail = process.env.FROM_EMAIL

    if (!xeroBillsEmail || !xeroReceiptsEmail) {
      console.log('Xero email addresses not configured, skipping Xero send')
      return
    }
    if (!fromEmail) throw new Error('FROM_EMAIL environment variable is not set')

    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    // Extract invoice number from filename
    const invoiceNumMatch = invoice.fileName.match(/Invoice (\d+)\.pdf$/i)
    const invoiceNum = invoiceNumMatch?.[1] ?? '0'

    // Use Resend's `path` option — Resend fetches the file from the URL directly,
    // so we never load PDFs into the Convex action's 64MB memory.
    const invoiceFileUrl = await ctx.storage.getUrl(invoice.storageId)
    if (!invoiceFileUrl) throw new Error('Invoice file URL not found')

    // Send invoice to Xero bills
    const { error: billError } = await resend.emails.send({
      from: fromEmail,
      to: xeroBillsEmail,
      subject: `${startupName} Invoice ${invoiceNum}`,
      text: `Invoice ${invoiceNum} from ${startupName}`,
      attachments: [{ filename: invoice.fileName, path: invoiceFileUrl }],
    })
    if (billError) {
      throw new Error(`Failed to send invoice to Xero: ${billError.message}`)
    }

    // Collect receipt storage IDs (handle both old single and new array format)
    // For batch invoices, merge original invoice files + receipts for Xero
    const originalIds: string[] = invoice.originalInvoiceStorageIds ?? []
    const originalNames: string[] = invoice.originalInvoiceFileNames ?? []

    // Rename original invoices so it's clear which batch they belong to in Xero
    const renamedOriginalNames = originalNames.map((name) => {
      const origMatch = name.match(/Invoice (\d+)\.pdf$/i)
      if (!origMatch) return name // preserve original name if pattern doesn't match
      return `${startupName} Batch ${invoiceNum} - Original Invoice ${origMatch[1]}.pdf`
    })

    const receiptIds: string[] = [
      ...originalIds,
      ...(invoice.receiptStorageIds ??
        (invoice.receiptStorageId ? [invoice.receiptStorageId] : [])),
    ]
    const receiptNames: string[] = [
      ...renamedOriginalNames,
      ...(invoice.receiptFileNames ?? (invoice.receiptFileName ? [invoice.receiptFileName] : [])),
    ]

    // Send all receipts in a single email — Resend fetches each via URL
    const receiptAttachments = []
    for (let i = 0; i < receiptIds.length; i++) {
      const receiptFileUrl = await ctx.storage.getUrl(receiptIds[i] as Id<'_storage'>)
      if (!receiptFileUrl) continue
      receiptAttachments.push({
        filename: receiptNames[i] || `Receipt ${i + 1}.pdf`,
        path: receiptFileUrl,
      })
    }

    if (receiptAttachments.length > 0) {
      const { error: receiptError } = await resend.emails.send({
        from: fromEmail,
        to: xeroReceiptsEmail,
        subject: `${startupName} Receipts for Invoice ${invoiceNum}`,
        text: `Receipts for Invoice ${invoiceNum} from ${startupName}`,
        attachments: receiptAttachments,
      })
      if (receiptError) {
        throw new Error(`Failed to send receipts to Xero: ${receiptError.message}`)
      }
    }
  },
})

/**
 * Get component invoices for a batch invoice.
 */
export const getComponentInvoices = query({
  args: { ids: v.array(v.id('invoices')) },
  handler: async (ctx, args) => {
    await requireAuth(ctx)
    const results = []
    for (const id of args.ids) {
      const inv = await ctx.db.get(id)
      if (inv) {
        results.push({
          _id: inv._id,
          vendorName: inv.vendorName,
          amountGbp: inv.amountGbp,
          invoiceDate: inv.invoiceDate,
          fileName: inv.fileName,
          storageId: inv.storageId,
          description: inv.description,
        })
      }
    }
    return results
  },
})
