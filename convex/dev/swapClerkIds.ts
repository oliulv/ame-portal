import { internalMutation } from '../functions'

// TODO: Fill in actual Clerk IDs
const SWAPS = [
  // Super admin — your prod super_admin account → your dev super_admin test account
  {
    prodClerkId: 'user_3AROWgxuZ7nCII5SKsN9XSQnwRU',
    devClerkId: 'user_3A6qOM3s1o7PGR61JPGkX7CgzKo',
  },
  // Admin — your prod admin account → your dev admin test account
  {
    prodClerkId: 'user_3AZW0GqyKBzXqxC5jGf5oMw6nuk',
    devClerkId: 'user_3AZadW7ezwPpAhPnzlOlG1D4zMN',
  },
  // Founder — pick any real founder from prod whose startup you want to test as
  // When you sign in as your dev founder account, you'll see their startup's data
  {
    prodClerkId: 'user_3AX6eOO5SOzh6aZVUQYt5t4xVtq',
    devClerkId: 'user_3AnkoO5kRQnKeQ3UrMfJPohVbxz',
  },
]

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.APP_URL === 'https://www.ameportal.com') {
      throw new Error('SAFETY: Cannot swap Clerk IDs in production!')
    }

    for (const { prodClerkId, devClerkId } of SWAPS) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_clerkId', (q) => q.eq('clerkId', prodClerkId))
        .unique()

      if (!user) {
        console.log(`SKIP: No user found with clerkId ${prodClerkId}`)
        continue
      }

      await ctx.db.patch(user._id, { clerkId: devClerkId })
      console.log(`SWAPPED: ${user.fullName ?? user.email ?? user._id} → ${devClerkId}`)
    }

    console.log('Clerk ID swap complete.')
  },
})
