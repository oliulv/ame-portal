import { internalMutation } from '../_generated/server'
import { v } from 'convex/values'

export const run = internalMutation({
  args: { id: v.id('perks') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      details:
        'All Accelerate ME alumni and cohort startups get $300 in Supabase credits. Click "Redeem" to generate your unique redemption code — credits are applied instantly to your Supabase organisation. One redemption per founder.',
      url: '',
    })
  },
})
