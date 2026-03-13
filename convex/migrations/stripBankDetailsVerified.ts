import { internalMutation } from '../functions'

/**
 * One-shot migration: remove the stale `verified` field from bankDetails docs.
 * `ctx.db.patch()` can't remove fields, so we use `ctx.db.replace()`.
 *
 * Run locally:  npx convex run migrations/stripBankDetailsVerified:run
 * Run on prod:  npx convex run --url <prod-url> migrations/stripBankDetailsVerified:run
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allBankDetails = await ctx.db.query('bankDetails').collect()
    let updated = 0

    for (const doc of allBankDetails) {
      if ('verified' in (doc as any)) {
        await ctx.db.replace(doc._id, {
          startupId: doc.startupId,
          accountHolderName: doc.accountHolderName,
          sortCode: doc.sortCode,
          accountNumber: doc.accountNumber,
          bankName: doc.bankName,
        })
        updated++
      }
    }

    console.log(`stripBankDetailsVerified: updated ${updated} of ${allBankDetails.length} docs`)
  },
})
