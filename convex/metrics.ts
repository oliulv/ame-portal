import { query, mutation, action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAuth, requireAdmin } from "./auth";

/**
 * Store metric snapshots.
 */
export const store = mutation({
  args: {
    snapshots: v.array(
      v.object({
        startupId: v.id("startups"),
        provider: v.union(
          v.literal("stripe"),
          v.literal("tracker"),
          v.literal("manual")
        ),
        metricKey: v.string(),
        value: v.number(),
        timestamp: v.string(),
        window: v.union(
          v.literal("daily"),
          v.literal("weekly"),
          v.literal("monthly")
        ),
        meta: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const snapshot of args.snapshots) {
      await ctx.db.insert("metricsData", snapshot);
    }
  },
});

/**
 * Get latest metric value for a startup/provider/metric.
 */
export const getLatest = query({
  args: {
    startupId: v.id("startups"),
    provider: v.union(
      v.literal("stripe"),
      v.literal("tracker"),
      v.literal("manual")
    ),
    metricKey: v.string(),
    window: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly")
    ),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const metrics = await ctx.db
      .query("metricsData")
      .withIndex("by_startupId_provider_metricKey", (q) =>
        q
          .eq("startupId", args.startupId)
          .eq("provider", args.provider)
          .eq("metricKey", args.metricKey)
      )
      .filter((q) => q.eq(q.field("window"), args.window))
      .collect();

    if (metrics.length === 0) return null;

    // Sort by timestamp descending, return latest
    metrics.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return metrics[0].value;
  },
});

/**
 * Get metric time series.
 */
export const timeSeries = query({
  args: {
    startupId: v.id("startups"),
    provider: v.union(
      v.literal("stripe"),
      v.literal("tracker"),
      v.literal("manual")
    ),
    metricKey: v.string(),
    window: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly")
    ),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    let metrics = await ctx.db
      .query("metricsData")
      .withIndex("by_startupId_provider_metricKey", (q) =>
        q
          .eq("startupId", args.startupId)
          .eq("provider", args.provider)
          .eq("metricKey", args.metricKey)
      )
      .filter((q) => q.eq(q.field("window"), args.window))
      .collect();

    // Filter by date range
    if (args.startDate) {
      metrics = metrics.filter((m) => m.timestamp >= args.startDate!);
    }
    if (args.endDate) {
      metrics = metrics.filter((m) => m.timestamp <= args.endDate!);
    }

    metrics.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return metrics.map((m) => ({
      timestamp: m.timestamp,
      value: m.value,
    }));
  },
});

/**
 * Fetch and store Stripe metrics for a startup (action).
 */
export const fetchStripeMetrics = internalAction({
  args: { startupId: v.id("startups") },
  handler: async (ctx, args) => {
    // Get the connection
    const connection: any = await ctx.runQuery(
      internal.metrics.getStripeConnection,
      { startupId: args.startupId }
    );

    if (!connection?.accessToken) return;

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(connection.accessToken, {
      apiVersion: "2025-11-17.clover",
    });

    const now = new Date();
    const thirtyDaysAgo = Math.floor(
      (now.getTime() - 30 * 24 * 60 * 60 * 1000) / 1000
    );

    const charges = await stripe.charges.list({
      created: { gte: thirtyDaysAgo },
      limit: 100,
    });

    const totalRevenue =
      charges.data
        .filter((c) => c.status === "succeeded")
        .reduce((sum, c) => sum + (c.amount || 0), 0) / 100;

    const uniqueCustomers = new Set(
      charges.data
        .map((c) => c.customer)
        .filter((c): c is string => Boolean(c))
    ).size;

    let mrr = 0;
    const subscriptions = await stripe.subscriptions.list({
      limit: 100,
      status: "active",
    });

    for (const sub of subscriptions.data) {
      if (sub.items.data.length > 0) {
        const price = sub.items.data[0].price;
        if (price?.recurring?.interval === "month") {
          mrr += (price.unit_amount || 0) / 100;
        } else if (price?.recurring?.interval === "year") {
          mrr += (price.unit_amount || 0) / 100 / 12;
        }
      }
    }

    const timestamp = now.toISOString();

    await ctx.runMutation(internal.metrics.storeInternal, {
      snapshots: [
        {
          startupId: args.startupId,
          provider: "stripe",
          metricKey: "total_revenue",
          value: totalRevenue,
          timestamp,
          window: "daily",
        },
        {
          startupId: args.startupId,
          provider: "stripe",
          metricKey: "active_customers",
          value: uniqueCustomers,
          timestamp,
          window: "daily",
        },
        {
          startupId: args.startupId,
          provider: "stripe",
          metricKey: "mrr",
          value: mrr,
          timestamp,
          window: "daily",
        },
      ],
    });
  },
});

/**
 * Internal query to get Stripe connection for a startup.
 */
export const getStripeConnection = query({
  args: { startupId: v.id("startups") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrationConnections")
      .withIndex("by_startupId_provider", (q) =>
        q.eq("startupId", args.startupId).eq("provider", "stripe")
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("isActive"), true),
          q.eq(q.field("status"), "active")
        )
      )
      .first();
  },
});

/**
 * Internal mutation to store metrics (used by actions).
 */
export const storeInternal = mutation({
  args: {
    snapshots: v.array(
      v.object({
        startupId: v.id("startups"),
        provider: v.union(
          v.literal("stripe"),
          v.literal("tracker"),
          v.literal("manual")
        ),
        metricKey: v.string(),
        value: v.number(),
        timestamp: v.string(),
        window: v.union(
          v.literal("daily"),
          v.literal("weekly"),
          v.literal("monthly")
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const snapshot of args.snapshots) {
      await ctx.db.insert("metricsData", snapshot);
    }
  },
});
