import { internalMutation } from '../_generated/server'

const PARTNERSHIP_PROVIDERS = new Set([
  'Scaleway',
  'NVIDIA Inception',
  'Supabase',
  'GitHub',
  'HubSpot',
  'Notion',
])

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const perks = await ctx.db.query('perks').collect()

    for (const perk of perks) {
      const isPartnership = PARTNERSHIP_PROVIDERS.has(perk.providerName?.trim() ?? '')
      await ctx.db.patch(perk._id, { isPartnership })
    }

    return { updated: perks.length }
  },
})
