import { query, mutation } from './functions'
import { v } from 'convex/values'
import { requireFounder } from './auth'

/**
 * Complete multi-step onboarding: personal info, startup profile, bank details.
 */
export const complete = mutation({
  args: {
    founderInfo: v.object({
      addressLine1: v.string(),
      addressLine2: v.optional(v.string()),
      city: v.string(),
      postcode: v.string(),
      country: v.string(),
      phone: v.string(),
      bio: v.optional(v.string()),
      linkedinUrl: v.optional(v.string()),
      xUrl: v.optional(v.string()),
    }),
    startupProfile: v.object({
      oneLiner: v.string(),
      description: v.string(),
      companyUrl: v.optional(v.string()),
      productUrl: v.optional(v.string()),
      industry: v.string(),
      location: v.string(),
      initialCustomers: v.optional(v.number()),
      initialRevenue: v.optional(v.number()),
    }),
    bankDetails: v.optional(
      v.object({
        accountHolderName: v.string(),
        sortCode: v.string(),
        accountNumber: v.string(),
        bankName: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireFounder(ctx)

    // Get founder profile
    const founderProfile = await ctx.db
      .query('founderProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (!founderProfile) throw new Error('Founder profile not found')

    // Update founder profile with personal info
    await ctx.db.patch(founderProfile._id, {
      addressLine1: args.founderInfo.addressLine1,
      addressLine2: args.founderInfo.addressLine2,
      city: args.founderInfo.city,
      postcode: args.founderInfo.postcode,
      country: args.founderInfo.country,
      phone: args.founderInfo.phone,
      bio: args.founderInfo.bio,
      linkedinUrl: args.founderInfo.linkedinUrl,
      xUrl: args.founderInfo.xUrl,
      onboardingStatus: 'completed',
    })

    // Sync name/email to users table for founder-only users.
    // Admin/super_admin users get their email synced from Clerk via ensureUser(),
    // so we should not overwrite it with the founder invitation email.
    if (user.role === 'founder') {
      await ctx.db.patch(user._id, {
        email: founderProfile.personalEmail,
        fullName: founderProfile.fullName,
      })
    }

    // Upsert startup profile
    const existingProfile = await ctx.db
      .query('startupProfiles')
      .withIndex('by_startupId', (q) => q.eq('startupId', founderProfile.startupId))
      .first()

    const profileData = {
      oneLiner: args.startupProfile.oneLiner,
      description: args.startupProfile.description,
      companyUrl: args.startupProfile.companyUrl,
      productUrl: args.startupProfile.productUrl,
      industry: args.startupProfile.industry,
      location: args.startupProfile.location,
      initialCustomers: args.startupProfile.initialCustomers,
      initialRevenue: args.startupProfile.initialRevenue,
    }

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, profileData)
    } else {
      await ctx.db.insert('startupProfiles', {
        startupId: founderProfile.startupId,
        ...profileData,
      })
    }

    // Upsert bank details if provided
    if (args.bankDetails) {
      const existingBank = await ctx.db
        .query('bankDetails')
        .withIndex('by_startupId', (q) => q.eq('startupId', founderProfile.startupId))
        .first()

      const bankData = {
        accountHolderName: args.bankDetails.accountHolderName,
        sortCode: args.bankDetails.sortCode,
        accountNumber: args.bankDetails.accountNumber,
        bankName: args.bankDetails.bankName,
        verified: false,
      }

      if (existingBank) {
        await ctx.db.patch(existingBank._id, bankData)
      } else {
        await ctx.db.insert('bankDetails', {
          startupId: founderProfile.startupId,
          ...bankData,
        })
      }
    }

    // Update startup onboarding status
    await ctx.db.patch(founderProfile.startupId, {
      onboardingStatus: 'completed',
    })
  },
})

/**
 * Check if bank details exist for the current founder's startup.
 */
export const bankStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFounder(ctx)

    const founderProfile = await ctx.db
      .query('founderProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (!founderProfile) return { hasBankDetails: false }

    const bankDetails = await ctx.db
      .query('bankDetails')
      .withIndex('by_startupId', (q) => q.eq('startupId', founderProfile.startupId))
      .first()

    return { hasBankDetails: !!bankDetails }
  },
})
