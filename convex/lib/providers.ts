import { v } from 'convex/values'

/**
 * Single source of truth for integration provider types.
 * Used in: integrationConnections, metricsData, and any provider-aware code.
 */
export const providerValidator = v.union(
  v.literal('stripe'),
  v.literal('tracker'),
  v.literal('github'),
  v.literal('apify'),
  v.literal('manual')
)

export type Provider = 'stripe' | 'tracker' | 'github' | 'apify' | 'manual'

/**
 * Providers that can appear in integrationConnections (excludes 'manual').
 */
export const connectionProviderValidator = v.union(
  v.literal('stripe'),
  v.literal('tracker'),
  v.literal('github'),
  v.literal('apify')
)

export type ConnectionProvider = 'stripe' | 'tracker' | 'github' | 'apify'

/**
 * Social media platforms supported via Apify scraping.
 */
export const socialPlatformValidator = v.union(
  v.literal('twitter'),
  v.literal('linkedin'),
  v.literal('instagram')
)

export type SocialPlatform = 'twitter' | 'linkedin' | 'instagram'

/**
 * MRR movement types for revenue decomposition.
 */
export const mrrMovementTypeValidator = v.union(
  v.literal('new'),
  v.literal('expansion'),
  v.literal('contraction'),
  v.literal('churn'),
  v.literal('reactivation')
)

export type MrrMovementType = 'new' | 'expansion' | 'contraction' | 'churn' | 'reactivation'
