import { query, mutation } from './functions'
import { v } from 'convex/values'
import {
  requireAdmin,
  requireAdminWithPermission,
  requireFounder,
  requireAuth,
  getFounderStartupIds,
} from './auth'

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
    receiptStorageId: v.id('_storage'),
    receiptFileName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)

    if (startupIds.length === 0) {
      throw new Error('No startup associated with your account')
    }

    const startupId = startupIds[0]
    const startup = await ctx.db.get(startupId)
    if (!startup) throw new Error('Startup not found')

    // Validate PDF extension
    if (!args.fileName.toLowerCase().endsWith('.pdf')) {
      throw new Error('Invoice must be a PDF file')
    }
    if (!args.receiptFileName.toLowerCase().endsWith('.pdf')) {
      throw new Error('Receipt must be a PDF file')
    }

    // Validate naming convention: "{StartupName} Invoice {N}.pdf"
    const namePattern = new RegExp(
      `^${startup.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Invoice \\d+\\.pdf$`,
      'i'
    )
    if (!namePattern.test(args.fileName)) {
      throw new Error(
        `Invoice must be named "${startup.name} Invoice {number}.pdf" (e.g. "${startup.name} Invoice 1.pdf")`
      )
    }

    // Enforce sequential invoice numbering
    const existingInvoices = await ctx.db
      .query('invoices')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
      .collect()

    const existingNumbers = existingInvoices
      .map((inv) => {
        const match = inv.fileName.match(/Invoice (\d+)\.pdf$/i)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter((n) => n > 0)
    const maxExisting = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0
    const expectedNext = maxExisting + 1

    const invoiceNum = args.fileName.match(/Invoice (\d+)\.pdf$/i)?.[1]
    if (!invoiceNum || parseInt(invoiceNum, 10) !== expectedNext) {
      throw new Error(
        `Invoice number must be ${expectedNext}. Please name your file "${startup.name} Invoice ${expectedNext}.pdf".`
      )
    }

    // Validate receipt naming
    const receiptPattern = new RegExp(
      `^${startup.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Receipt \\d+\\.pdf$`,
      'i'
    )
    if (!receiptPattern.test(args.receiptFileName)) {
      throw new Error(
        `Receipt must be named "${startup.name} Receipt {number}.pdf" (e.g. "${startup.name} Receipt ${expectedNext}.pdf")`
      )
    }

    // Enforce matching number between invoice and receipt
    const receiptNum = args.receiptFileName.match(/Receipt (\d+)\.pdf$/i)?.[1]
    if (receiptNum && parseInt(receiptNum, 10) !== expectedNext) {
      throw new Error(
        `Receipt number must be ${expectedNext} to match the invoice. Please name your file "${startup.name} Receipt ${expectedNext}.pdf".`
      )
    }

    // Validate amount against available balance
    const milestones = await ctx.db
      .query('milestones')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
      .collect()
    const unlocked = milestones
      .filter((m) => m.status === 'approved')
      .reduce((sum, m) => sum + m.amount, 0)
    const deployed = existingInvoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + i.amountGbp, 0)
    const available = Math.max(0, unlocked - deployed)

    if (available <= 0) {
      throw new Error(
        'No available funding. Complete milestones to unlock funding before submitting invoices.'
      )
    }
    if (args.amountGbp > available) {
      throw new Error(
        `Amount exceeds available balance. You have £${available.toFixed(2)} available.`
      )
    }

    return await ctx.db.insert('invoices', {
      startupId,
      uploadedByUserId: user._id,
      vendorName: args.vendorName,
      invoiceDate: args.invoiceDate,
      amountGbp: args.amountGbp,
      description: args.description,
      storageId: args.storageId,
      fileName: args.fileName,
      receiptStorageId: args.receiptStorageId,
      receiptFileName: args.receiptFileName,
      status: 'submitted',
    })
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

    const existingNumbers = invoices
      .map((inv) => {
        const match = inv.fileName.match(/Invoice (\d+)\.pdf$/i)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter((n) => n > 0)
    const maxExisting = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0

    return {
      startupName: startup.name,
      nextInvoiceNumber: maxExisting + 1,
    }
  },
})

/**
 * Get the founder's startup name (for invoice naming validation).
 * @deprecated Use getFounderInvoiceInfo instead.
 */
export const getFounderStartupName = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)
    const startupIds = await getFounderStartupIds(ctx, user._id)
    if (startupIds.length === 0) return null
    const startup = await ctx.db.get(startupIds[0])
    return startup?.name ?? null
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

    // Sort newest first
    allInvoices.sort((a, b) => b._creationTime - a._creationTime)

    const pendingCount = allInvoices.filter(
      (i) => i.status === 'submitted' || i.status === 'under_review'
    ).length

    return { invoices: allInvoices, pendingCount }
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
    const validTransitions: Record<string, string[]> = {
      submitted: ['approved', 'rejected', 'under_review'],
      under_review: ['approved', 'rejected'],
      approved: ['paid'],
      rejected: [],
      paid: [],
    }

    const allowed = validTransitions[invoice.status] ?? []
    if (!allowed.includes(args.status)) {
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
  },
})
