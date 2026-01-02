import { redis } from './redis'
import { cacheKeys } from './keys'

/**
 * Invalidate cache entries when data is mutated
 * Call these from API routes after successful mutations
 */

// Invalidate a specific startup's cached data
export async function invalidateStartup(slug: string) {
  await Promise.all([redis.del(cacheKeys.startup(slug)), redis.del(cacheKeys.startupDetail(slug))])
}

// Invalidate all startup-related caches for a cohort (useful when startup is added/removed)
export async function invalidateStartupsByCohort(cohortId: string) {
  await redis.del(cacheKeys.startupsByCohort(cohortId))
}

// Invalidate leaderboard cache for a cohort
export async function invalidateLeaderboard(cohortSlug: string) {
  await redis.del(cacheKeys.leaderboard(cohortSlug))
}

// Invalidate cohort data
export async function invalidateCohort(slug: string) {
  await redis.del(cacheKeys.cohort(slug))
}

// Invalidate invoices for a cohort
export async function invalidateInvoicesByCohort(cohortSlug: string) {
  await redis.del(cacheKeys.invoicesByCohort(cohortSlug))
}

// Invalidate a specific invoice
export async function invalidateInvoice(id: string) {
  await redis.del(cacheKeys.invoice(id))
}

// Invalidate goals for a startup (also invalidates leaderboard since goals affect scores)
export async function invalidateGoals(startupId: string, startupSlug: string, cohortSlug: string) {
  await Promise.all([
    redis.del(cacheKeys.goalsByStartup(startupId)),
    redis.del(cacheKeys.startupDetail(startupSlug)),
    redis.del(cacheKeys.leaderboard(cohortSlug)),
  ])
}

// Batch invalidation for when a startup is updated (affects multiple caches)
export async function invalidateStartupFull(
  startupSlug: string,
  cohortSlug: string,
  cohortId: string
) {
  await Promise.all([
    invalidateStartup(startupSlug),
    invalidateStartupsByCohort(cohortId),
    invalidateLeaderboard(cohortSlug),
  ])
}
