// Cache key generators for consistent key naming
// Pattern: entity:identifier or entity:scope:identifier

export const cacheKeys = {
  // Cohort data (rarely changes)
  cohort: (slug: string) => `cohort:${slug}`,

  // Startup data
  startup: (slug: string) => `startup:${slug}`,
  startupDetail: (slug: string) => `startup-detail:${slug}`,
  startupsByCohort: (cohortId: string) => `startups-by-cohort:${cohortId}`,

  // Leaderboard (aggregated data)
  leaderboard: (cohortSlug: string) => `leaderboard:${cohortSlug}`,

  // Invoices
  invoicesByCohort: (cohortSlug: string) => `invoices-by-cohort:${cohortSlug}`,
  invoice: (id: string) => `invoice:${id}`,

  // Goals - used for invalidation patterns
  goalsByStartup: (startupId: string) => `goals-by-startup:${startupId}`,
}

// TTL values in seconds
export const cacheTTL = {
  cohort: 300,        // 5 minutes - cohorts rarely change
  startup: 60,        // 1 minute
  startupDetail: 30,  // 30 seconds - includes goals, invoices etc
  leaderboard: 30,    // 30 seconds - updates with goal completions
  invoices: 30,       // 30 seconds - new uploads possible
  invoice: 60,        // 1 minute - rarely edited after creation
}
