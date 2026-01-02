import { redis } from './redis'

export { cacheKeys, cacheTTL } from './keys'
export { redis } from './redis'

/**
 * Generic cache wrapper - check cache first, fetch if miss, store and return
 *
 * @param key - Cache key
 * @param fetcher - Async function to fetch data on cache miss
 * @param ttlSeconds - Time to live in seconds
 * @returns Cached or freshly fetched data
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  // Try to get from cache
  const cachedData = await redis.get<T>(key)

  if (cachedData !== null) {
    return cachedData
  }

  // Cache miss - fetch fresh data
  const freshData = await fetcher()

  // Store in cache (don't await - fire and forget for performance)
  redis.set(key, freshData, { ex: ttlSeconds }).catch((err) => {
    console.error(`Cache set failed for key ${key}:`, err)
  })

  return freshData
}

/**
 * Cache with null handling - useful when null is a valid cached value
 * Uses a wrapper object to distinguish between "not in cache" and "cached null"
 */
export async function cachedNullable<T>(
  key: string,
  fetcher: () => Promise<T | null>,
  ttlSeconds: number
): Promise<T | null> {
  type CacheWrapper = { value: T | null; __cached: true }

  const cached = await redis.get<CacheWrapper>(key)

  if (cached !== null && cached.__cached) {
    return cached.value
  }

  const freshData = await fetcher()

  redis.set(key, { value: freshData, __cached: true }, { ex: ttlSeconds }).catch((err) => {
    console.error(`Cache set failed for key ${key}:`, err)
  })

  return freshData
}
