import { QueryClient } from '@tanstack/react-query'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time: how long data is considered fresh
        // Default to 5 minutes, but individual queries can override
        staleTime: 1000 * 60 * 5, // 5 minutes for most data
        // Cache time: how long unused data stays in cache
        gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
        // Retry failed requests
        retry: 1,
        // Refetch on window focus for fresh data (but only if stale)
        refetchOnWindowFocus: true,
        // Refetch on reconnect
        refetchOnReconnect: true,
      },
      mutations: {
        // Retry failed mutations once
        retry: 1,
      },
    },
  })
}

// Create a singleton instance for the app
let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return createQueryClient()
  } else {
    // Browser: use singleton pattern to keep the same query client
    if (!browserQueryClient) browserQueryClient = createQueryClient()
    return browserQueryClient
  }
}

