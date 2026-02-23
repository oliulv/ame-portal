import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  requireAdmin,
  requireFounder,
  requireAuth,
  getFounderStartupIds,
} from "./auth";

/**
 * Generate a pre-signed upload URL for invoice files.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get a URL for a stored file.
 */
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Create an invoice record (founder uploads file, then creates record).
 */
export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    vendorName: v.string(),
    invoiceDate: v.string(),
    amountGbp: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx);
    const startupIds = await getFounderStartupIds(ctx, user._id);

    if (startupIds.length === 0) {
      throw new Error("No startup associated with your account");
    }

    return await ctx.db.insert("invoices", {
      startupId: startupIds[0],
      uploadedByUserId: user._id,
      vendorName: args.vendorName,
      invoiceDate: args.invoiceDate,
      amountGbp: args.amountGbp,
      description: args.description,
      storageId: args.storageId,
      fileName: args.fileName,
      status: "submitted",
    });
  },
});

/**
 * List invoices for the current founder.
 */
export const listForFounder = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx);
    const startupIds = await getFounderStartupIds(ctx, user._id);

    if (startupIds.length === 0) {
      return { invoices: [], pendingCount: 0 };
    }

    const allInvoices = [];
    for (const startupId of startupIds) {
      const invoices = await ctx.db
        .query("invoices")
        .withIndex("by_startupId", (q) => q.eq("startupId", startupId))
        .collect();
      allInvoices.push(...invoices);
    }

    // Sort newest first
    allInvoices.sort((a, b) => b._creationTime - a._creationTime);

    const pendingCount = allInvoices.filter(
      (i) => i.status === "submitted" || i.status === "under_review"
    ).length;

    return { invoices: allInvoices, pendingCount };
  },
});

/**
 * List all invoices (admin view), optionally filtered by startup or status.
 */
export const listForAdmin = query({
  args: {
    startupId: v.optional(v.id("startups")),
    status: v.optional(
      v.union(
        v.literal("submitted"),
        v.literal("under_review"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("paid")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let invoices;

    if (args.startupId) {
      invoices = await ctx.db
        .query("invoices")
        .withIndex("by_startupId", (q) => q.eq("startupId", args.startupId!))
        .collect();
    } else if (args.status) {
      invoices = await ctx.db
        .query("invoices")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      invoices = await ctx.db.query("invoices").collect();
    }

    // Apply both filters if needed
    if (args.startupId && args.status) {
      invoices = invoices.filter((i) => i.status === args.status);
    }

    invoices.sort((a, b) => b._creationTime - a._creationTime);
    return invoices;
  },
});

/**
 * Get a single invoice by ID.
 */
export const getById = query({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db.get(args.id);
  },
});

/**
 * Update invoice status (admin: approve, reject, mark paid).
 */
export const updateStatus = mutation({
  args: {
    id: v.id("invoices"),
    status: v.union(
      v.literal("under_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("paid")
    ),
    adminComment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const invoice = await ctx.db.get(args.id);
    if (!invoice) throw new Error("Invoice not found");

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      submitted: ["approved", "rejected", "under_review"],
      under_review: ["approved", "rejected"],
      approved: ["paid"],
      rejected: [],
      paid: [],
    };

    const allowed = validTransitions[invoice.status] ?? [];
    if (!allowed.includes(args.status)) {
      throw new Error(
        `Cannot change status from "${invoice.status}" to "${args.status}"`
      );
    }

    const patch: Record<string, unknown> = {
      status: args.status,
    };

    if (args.adminComment !== undefined) {
      patch.adminComment = args.adminComment?.trim() || undefined;
    }

    if (args.status === "approved") {
      patch.approvedByAdminId = admin._id;
      patch.approvedAt = new Date().toISOString();
    }

    if (args.status === "paid") {
      patch.paidAt = new Date().toISOString();
    }

    await ctx.db.patch(args.id, patch);
  },
});
