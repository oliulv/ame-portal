import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";

/**
 * List goal templates, optionally filtered by cohort.
 * Deduplicates "Join AccelerateMe" per cohort.
 */
export const list = query({
  args: { cohortId: v.optional(v.id("cohorts")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let templates;
    if (args.cohortId) {
      templates = await ctx.db
        .query("goalTemplates")
        .withIndex("by_cohortId", (q) => q.eq("cohortId", args.cohortId!))
        .collect();
    } else {
      templates = await ctx.db.query("goalTemplates").collect();
    }

    // Sort by sortOrder, then creation time
    templates.sort(
      (a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity)
    );

    // Deduplicate "Join AccelerateMe" per cohort
    const seenAccelerateMe = new Set<string>();
    return templates.filter((t) => {
      const isAMe =
        t.title === "Join AccelerateMe" ||
        t.title?.toLowerCase().includes("join accelerateme");
      if (isAMe) {
        const key = t.cohortId;
        if (seenAccelerateMe.has(key)) return false;
        seenAccelerateMe.add(key);
      }
      return true;
    });
  },
});

/**
 * Get a single goal template by ID.
 */
export const getById = query({
  args: { id: v.id("goalTemplates") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

/**
 * Create a goal template. If active, auto-assign to existing startups in the cohort.
 */
export const create = mutation({
  args: {
    cohortId: v.id("cohorts"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    defaultTargetValue: v.optional(v.number()),
    defaultDeadline: v.optional(v.string()),
    defaultWeight: v.number(),
    defaultFundingAmount: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Get next sort order
    const existing = await ctx.db
      .query("goalTemplates")
      .withIndex("by_cohortId", (q) => q.eq("cohortId", args.cohortId))
      .collect();

    const maxOrder = existing.reduce(
      (max, t) => Math.max(max, t.sortOrder ?? 0),
      0
    );

    const templateId = await ctx.db.insert("goalTemplates", {
      cohortId: args.cohortId,
      title: args.title,
      description: args.description,
      category: args.category,
      defaultTargetValue: args.defaultTargetValue,
      defaultDeadline: args.defaultDeadline,
      defaultWeight: args.defaultWeight,
      defaultFundingAmount: args.defaultFundingAmount,
      isActive: args.isActive,
      sortOrder: maxOrder + 1,
    });

    // If active, auto-assign to existing startups
    if (args.isActive) {
      const startups = await ctx.db
        .query("startups")
        .withIndex("by_cohortId", (q) => q.eq("cohortId", args.cohortId))
        .collect();

      for (const startup of startups) {
        // Check if already has a goal from this template
        const existingGoal = await ctx.db
          .query("startupGoals")
          .withIndex("by_goalTemplateId", (q) =>
            q.eq("goalTemplateId", templateId)
          )
          .filter((q) => q.eq(q.field("startupId"), startup._id))
          .first();

        if (!existingGoal) {
          await ctx.db.insert("startupGoals", {
            startupId: startup._id,
            goalTemplateId: templateId,
            title: args.title,
            description: args.description,
            category: args.category,
            targetValue: args.defaultTargetValue,
            deadline: args.defaultDeadline,
            weight: args.defaultWeight || 1,
            fundingAmount: args.defaultFundingAmount,
            status: "not_started",
            progressValue: 0,
            manuallyOverridden: false,
          });
        }
      }
    }

    return templateId;
  },
});

/**
 * Update a goal template. If activated, auto-assign to startups.
 */
export const update = mutation({
  args: {
    id: v.id("goalTemplates"),
    cohortId: v.id("cohorts"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    defaultTargetValue: v.optional(v.number()),
    defaultDeadline: v.optional(v.string()),
    defaultWeight: v.optional(v.number()),
    defaultFundingAmount: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const current = await ctx.db.get(args.id);
    if (!current) throw new Error("Goal template not found");

    const wasInactive = !current.isActive;
    const isNowActive = args.isActive;

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    // If template was just activated, assign to existing startups
    if (wasInactive && isNowActive) {
      const startups = await ctx.db
        .query("startups")
        .withIndex("by_cohortId", (q) => q.eq("cohortId", args.cohortId))
        .collect();

      for (const startup of startups) {
        const existingGoal = await ctx.db
          .query("startupGoals")
          .withIndex("by_goalTemplateId", (q) => q.eq("goalTemplateId", id))
          .filter((q) => q.eq(q.field("startupId"), startup._id))
          .first();

        if (!existingGoal) {
          await ctx.db.insert("startupGoals", {
            startupId: startup._id,
            goalTemplateId: id,
            title: args.title,
            description: args.description,
            category: args.category,
            targetValue: args.defaultTargetValue,
            deadline: args.defaultDeadline,
            weight: current.defaultWeight || 1,
            fundingAmount: args.defaultFundingAmount,
            status: "not_started",
            progressValue: 0,
            manuallyOverridden: false,
          });
        }
      }
    }
  },
});

/**
 * Delete a goal template.
 */
export const remove = mutation({
  args: { id: v.id("goalTemplates") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

/**
 * Reorder goal templates by updating their sortOrder.
 */
export const reorder = mutation({
  args: {
    goalIds: v.array(v.id("goalTemplates")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    for (let i = 0; i < args.goalIds.length; i++) {
      await ctx.db.patch(args.goalIds[i], { sortOrder: i + 1 });
    }
  },
});

/**
 * Cleanup duplicate "Join AccelerateMe" goals, keeping oldest per cohort.
 */
export const cleanupDuplicates = mutation({
  args: { cohortId: v.optional(v.id("cohorts")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let templates;
    if (args.cohortId) {
      templates = await ctx.db
        .query("goalTemplates")
        .withIndex("by_cohortId", (q) => q.eq("cohortId", args.cohortId!))
        .collect();
    } else {
      templates = await ctx.db.query("goalTemplates").collect();
    }

    const amGoals = templates.filter(
      (t) =>
        t.title === "Join AccelerateMe" ||
        t.title?.toLowerCase().includes("join accelerateme")
    );

    // Group by cohort
    const byCohort = new Map<string, typeof amGoals>();
    for (const goal of amGoals) {
      const key = goal.cohortId;
      if (!byCohort.has(key)) byCohort.set(key, []);
      byCohort.get(key)!.push(goal);
    }

    let deletedCount = 0;
    for (const goals of byCohort.values()) {
      if (goals.length <= 1) continue;
      // Sort by _creationTime, keep oldest
      goals.sort((a, b) => a._creationTime - b._creationTime);
      for (let i = 1; i < goals.length; i++) {
        await ctx.db.delete(goals[i]._id);
        deletedCount++;
      }
    }

    return { deleted: deletedCount };
  },
});
