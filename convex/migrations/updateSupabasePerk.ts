import { internalMutation } from '../_generated/server'
import { v } from 'convex/values'

export const run = internalMutation({
  args: { id: v.id('perks') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      details:
        'Full backend platform with Postgres database, Auth, instant APIs, Edge Functions, Realtime, Storage & Vector embeddings — so you can focus on product, not infrastructure.\n\nAll Accelerate ME alumni and cohort startups get $300 in Supabase credits. Your portal email must match your Supabase account email. One redemption per founder.',
      url: '',
    })
  },
})
