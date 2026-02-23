import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireSuperAdmin } from "./auth";

/**
 * List admin users (admin + super_admin), optionally filtered by cohort.
 * Enriches with cohort assignments.
 */
export const list = query({
  args: { cohortId: v.optional(v.id("cohorts")) },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const allUsers = await ctx.db.query("users").collect();
    const admins = allUsers.filter(
      (u) => u.role === "admin" || u.role === "super_admin"
    );

    if (args.cohortId) {
      // Get admins assigned to this cohort
      const cohortAssignments = await ctx.db
        .query("adminCohorts")
        .withIndex("by_cohortId", (q) => q.eq("cohortId", args.cohortId!))
        .collect();

      const assignedUserIds = new Set(cohortAssignments.map((a) => a.userId));

      // Include super_admins (they see all) + cohort-assigned admins
      const filtered = admins.filter(
        (u) => u.role === "super_admin" || assignedUserIds.has(u._id)
      );

      // Enrich with all cohort assignments
      return await enrichWithCohorts(ctx, filtered);
    }

    // Return all admins with their cohort assignments
    return await enrichWithCohorts(ctx, admins);
  },
});

async function enrichWithCohorts(
  ctx: { db: { query: (table: "adminCohorts") => ReturnType<typeof ctx.db.query> } },
  users: Array<{
    _id: string;
    _creationTime: number;
    clerkId: string;
    role: "super_admin" | "admin" | "founder";
    email?: string;
    fullName?: string;
  }>
) {
  const allAssignments = await (ctx.db as any)
    .query("adminCohorts")
    .collect();

  const cohortMap = new Map<string, string[]>();
  for (const a of allAssignments) {
    if (!cohortMap.has(a.userId)) cohortMap.set(a.userId, []);
    cohortMap.get(a.userId)!.push(a.cohortId);
  }

  return users
    .map((u) => ({
      ...u,
      cohortIds: cohortMap.get(u._id) || [],
    }))
    .sort((a, b) => a._creationTime - b._creationTime);
}
