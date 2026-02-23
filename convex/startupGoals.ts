import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  requireAdmin,
  requireFounder,
  requireAuth,
  getFounderStartupIds,
} from "./auth";

/**
 * List goals for a specific startup (admin view).
 */
export const listByStartup = query({
  args: { startupId: v.id("startups") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const goals = await ctx.db
      .query("startupGoals")
      .withIndex("by_startupId", (q) => q.eq("startupId", args.startupId))
      .collect();

    // Enrich with template sort order
    const enriched = await Promise.all(
      goals.map(async (goal) => {
        let sortOrder: number | null = null;
        if (goal.goalTemplateId) {
          const template = await ctx.db.get(goal.goalTemplateId);
          sortOrder = template?.sortOrder ?? null;
        }
        return { ...goal, templateSortOrder: sortOrder };
      })
    );

    // Sort by template sort order, then creation time
    enriched.sort((a, b) => {
      if (a.templateSortOrder !== null && b.templateSortOrder !== null) {
        return a.templateSortOrder - b.templateSortOrder;
      }
      if (a.templateSortOrder !== null) return -1;
      if (b.templateSortOrder !== null) return 1;
      return a._creationTime - b._creationTime;
    });

    return enriched;
  },
});

/**
 * List goals for the current founder's startup(s).
 * Prepends a "Join AccelerateMe" goal as always-completed first item.
 */
export const listForFounder = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx);
    const startupIds = await getFounderStartupIds(ctx, user._id);

    if (startupIds.length === 0) return [];

    // Get the startup to find cohort
    const startup = await ctx.db.get(startupIds[0]);
    if (!startup) return [];

    // Fetch AccelerateMe template for this cohort
    const templates = await ctx.db
      .query("goalTemplates")
      .withIndex("by_cohortId", (q) => q.eq("cohortId", startup.cohortId))
      .collect();

    const amTemplate = templates.find(
      (t) =>
        t.title === "Join AccelerateMe" ||
        t.title?.toLowerCase().includes("join accelerateme")
    );

    // Fetch all goals for these startups
    const allGoals = [];
    for (const startupId of startupIds) {
      const goals = await ctx.db
        .query("startupGoals")
        .withIndex("by_startupId", (q) => q.eq("startupId", startupId))
        .collect();
      allGoals.push(...goals);
    }

    // Enrich with template sort order
    const enriched = await Promise.all(
      allGoals.map(async (goal) => {
        let sortOrder: number | null = null;
        if (goal.goalTemplateId) {
          const template = await ctx.db.get(goal.goalTemplateId);
          sortOrder = template?.sortOrder ?? null;
        }
        return { ...goal, templateSortOrder: sortOrder };
      })
    );

    // Sort by template sort order, then creation time
    enriched.sort((a, b) => {
      if (a.templateSortOrder !== null && b.templateSortOrder !== null) {
        return a.templateSortOrder - b.templateSortOrder;
      }
      if (a.templateSortOrder !== null) return -1;
      if (b.templateSortOrder !== null) return 1;
      return a._creationTime - b._creationTime;
    });

    // Prepend AccelerateMe goal
    const accelerateMeGoal = {
      _id: "goal-join-accelerateme" as never,
      _creationTime: 0,
      startupId: startupIds[0],
      goalTemplateId: amTemplate?._id ?? null,
      title: amTemplate?.title ?? "Join AccelerateMe",
      description:
        amTemplate?.description ??
        "Welcome to the program! Your journey starts here.",
      category: amTemplate?.category ?? "launch",
      status: "completed" as const,
      progressValue: 1,
      targetValue: 1,
      weight: 0,
      fundingAmount: amTemplate?.defaultFundingAmount ?? undefined,
      deadline: amTemplate?.defaultDeadline ?? undefined,
      manuallyOverridden: false,
      templateSortOrder: 0,
    };

    return [accelerateMeGoal, ...enriched];
  },
});

/**
 * Update a startup goal's status/progress.
 */
export const updateStatus = mutation({
  args: {
    id: v.id("startupGoals"),
    status: v.optional(
      v.union(
        v.literal("not_started"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("waived")
      )
    ),
    progressValue: v.optional(v.number()),
    manuallyOverridden: v.optional(v.boolean()),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const goal = await ctx.db.get(args.id);
    if (!goal) throw new Error("Goal not found");

    const previousStatus = goal.status;
    const previousProgress = goal.progressValue;

    const patch: Record<string, unknown> = {};
    if (args.status !== undefined) patch.status = args.status;
    if (args.progressValue !== undefined) patch.progressValue = args.progressValue;
    if (args.manuallyOverridden !== undefined)
      patch.manuallyOverridden = args.manuallyOverridden;

    // If completing, set completion metadata
    if (args.status === "completed") {
      patch.completionSource = "manual";
    }

    await ctx.db.patch(args.id, patch);

    // Create audit trail
    await ctx.db.insert("goalUpdates", {
      startupGoalId: args.id,
      userId: user._id,
      previousStatus,
      newStatus: args.status,
      previousProgress,
      newProgress: args.progressValue,
      comment: args.comment,
    });
  },
});
