import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireFounder } from "./auth";

/**
 * Get the founder's startup with profile.
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx);

    const founderProfile = await ctx.db
      .query("founderProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (!founderProfile) return null;

    const startup = await ctx.db.get(founderProfile.startupId);
    if (!startup) return null;

    const startupProfile = await ctx.db
      .query("startupProfiles")
      .withIndex("by_startupId", (q) =>
        q.eq("startupId", founderProfile.startupId)
      )
      .first();

    return { startup, startupProfile: startupProfile ?? null };
  },
});

/**
 * Update startup details (name, website, profile fields).
 */
export const update = mutation({
  args: {
    name: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    oneLiner: v.optional(v.string()),
    description: v.optional(v.string()),
    industry: v.optional(v.string()),
    location: v.optional(v.string()),
    initialCustomers: v.optional(v.number()),
    initialRevenue: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx);

    const founderProfile = await ctx.db
      .query("founderProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (!founderProfile) throw new Error("Founder profile not found");

    // Update startup table fields
    const startupPatch: Record<string, unknown> = {};
    if (args.name !== undefined) startupPatch.name = args.name;
    if (args.websiteUrl !== undefined) startupPatch.websiteUrl = args.websiteUrl;

    if (Object.keys(startupPatch).length > 0) {
      await ctx.db.patch(founderProfile.startupId, startupPatch);
    }

    // Update startup profile fields
    const profilePatch: Record<string, unknown> = {};
    if (args.oneLiner !== undefined) profilePatch.oneLiner = args.oneLiner;
    if (args.description !== undefined)
      profilePatch.description = args.description;
    if (args.industry !== undefined) profilePatch.industry = args.industry;
    if (args.location !== undefined) profilePatch.location = args.location;
    if (args.initialCustomers !== undefined)
      profilePatch.initialCustomers = args.initialCustomers;
    if (args.initialRevenue !== undefined)
      profilePatch.initialRevenue = args.initialRevenue;

    if (Object.keys(profilePatch).length > 0) {
      const existing = await ctx.db
        .query("startupProfiles")
        .withIndex("by_startupId", (q) =>
          q.eq("startupId", founderProfile.startupId)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, profilePatch);
      } else {
        await ctx.db.insert("startupProfiles", {
          startupId: founderProfile.startupId,
          ...profilePatch,
        });
      }
    }
  },
});
