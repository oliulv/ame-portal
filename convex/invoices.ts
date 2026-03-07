import { query, mutation, internalAction, internalQuery } from './functions'
import { internal } from './_generated/api'
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
    receiptStorageIds: v.array(v.id('_storage')),
    receiptFileNames: v.array(v.string()),
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

    // Validate at least one receipt
    if (args.receiptStorageIds.length === 0 || args.receiptFileNames.length === 0) {
      throw new Error('At least one receipt is required')
    }

    // Validate PDF extension
    if (!args.fileName.toLowerCase().endsWith('.pdf')) {
      throw new Error('Invoice must be a PDF file')
    }
    for (const name of args.receiptFileNames) {
      if (!name.toLowerCase().endsWith('.pdf')) {
        throw new Error('All receipts must be PDF files')
      }
    }

    // Validate naming convention: "{StartupName} Invoice {N}.pdf"
    const escapedName = startup.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const namePattern = new RegExp(`^${escapedName} Invoice \\d+\\.pdf$`, 'i')
    if (!namePattern.test(args.fileName)) {
      throw new Error(
        `Invoice must be named "${startup.name} Invoice {number}.pdf" (e.g. "${startup.name} Invoice 1.pdf")`
      )
    }

    // Enforce sequential invoice numbering (rejected invoices don't count)
    const existingInvoices = await ctx.db
      .query('invoices')
      .withIndex('by_startupId', (q) => q.eq('startupId', startupId))
      .collect()

    const existingNumbers = existingInvoices
      .filter((inv) => inv.status !== 'rejected')
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

    // Validate receipt naming: "{StartupName} Receipt {N}-{Letter}.pdf"
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for (let i = 0; i < args.receiptFileNames.length; i++) {
      const expectedLetter = letters[i]
      const receiptPattern = new RegExp(
        `^${escapedName} Receipt ${expectedNext}-${expectedLetter}\\.pdf$`,
        'i'
      )
      if (!receiptPattern.test(args.receiptFileNames[i])) {
        throw new Error(
          `Receipt ${i + 1} must be named "${startup.name} Receipt ${expectedNext}-${expectedLetter}.pdf"`
        )
      }
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
      // Array fields for multiple receipts
      receiptStorageIds: args.receiptStorageIds,
      receiptFileNames: args.receiptFileNames,
      // Backward compat: first receipt in legacy fields
      receiptStorageId: args.receiptStorageIds[0],
      receiptFileName: args.receiptFileNames[0],
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
      .filter((inv) => inv.status !== 'rejected')
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

    // Send to Xero on approval
    if (args.status === 'approved') {
      await ctx.scheduler.runAfter(0, internal.invoices.sendToXero, { invoiceId: args.id })
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

    // Download invoice PDF
    const invoiceUrl = await ctx.storage.getUrl(invoice.storageId)
    if (!invoiceUrl) throw new Error('Invoice file URL not found')
    const invoiceResponse = await fetch(invoiceUrl)
    const invoiceBuffer = Buffer.from(await invoiceResponse.arrayBuffer())

    // Send invoice to Xero bills
    const { error: billError } = await resend.emails.send({
      from: fromEmail,
      to: xeroBillsEmail,
      subject: `${startupName} Invoice ${invoiceNum}`,
      text: `Invoice ${invoiceNum} from ${startupName}`,
      attachments: [{ filename: invoice.fileName, content: invoiceBuffer }],
    })
    if (billError) {
      throw new Error(`Failed to send invoice to Xero: ${billError.message}`)
    }

    // Collect receipt storage IDs (handle both old single and new array format)
    const receiptIds: string[] =
      invoice.receiptStorageIds ?? (invoice.receiptStorageId ? [invoice.receiptStorageId] : [])
    const receiptNames: string[] =
      invoice.receiptFileNames ?? (invoice.receiptFileName ? [invoice.receiptFileName] : [])

    if (receiptIds.length > 0) {
      // Download all receipt PDFs
      const attachments = []
      for (let i = 0; i < receiptIds.length; i++) {
        const receiptUrl = await ctx.storage.getUrl(receiptIds[i] as any)
        if (!receiptUrl) continue
        const receiptResponse = await fetch(receiptUrl)
        const receiptBuffer = Buffer.from(await receiptResponse.arrayBuffer())
        attachments.push({
          filename: receiptNames[i] || `Receipt ${i + 1}.pdf`,
          content: receiptBuffer,
        })
      }

      if (attachments.length > 0) {
        const { error: receiptError } = await resend.emails.send({
          from: fromEmail,
          to: xeroReceiptsEmail,
          subject: `${startupName} Receipts for Invoice ${invoiceNum}`,
          text: `Receipts for Invoice ${invoiceNum} from ${startupName}`,
          attachments,
        })
        if (receiptError) {
          throw new Error(`Failed to send receipts to Xero: ${receiptError.message}`)
        }
      }
    }
  },
})
