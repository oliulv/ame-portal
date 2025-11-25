# Data Fetching Guide

This guide explains how to use TanStack Query and Supabase Realtime for data fetching and live updates across the application.

## Overview

We use **TanStack Query** (React Query) as our primary client-side data layer, combined with **Supabase Realtime** for cross-tab and multi-user synchronization. This ensures:

- **No manual refreshes needed** - UI updates automatically after mutations
- **Instant feedback** - Optimistic updates where safe
- **Cross-tab sync** - Changes in one tab appear in others instantly
- **Consistent patterns** - Same mental model everywhere

## Query Keys

All query keys are centralized in `lib/queryKeys.ts`. This ensures consistent cache invalidation.

```typescript
import { queryKeys } from '@/lib/queryKeys'

// List queries
queryKeys.cohorts.lists()
queryKeys.goals.list('admin')
queryKeys.goals.list('founder')

// Detail queries
queryKeys.cohorts.detail(slug)
queryKeys.goals.detail(id)
```

## Fetching Data

Use `useQuery` from TanStack Query:

```typescript
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { cohortsApi } from '@/lib/api/cohorts'

function MyComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.cohorts.lists(),
    queryFn: () => cohortsApi.getAll(),
    staleTime: 1000 * 60 * 5, // Optional: override default stale time
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return <div>{/* Render data */}</div>
}
```

## Mutations

Use `useAppMutation` for consistent mutation handling with automatic toast notifications and cache invalidation:

```typescript
import { useAppMutation } from '@/lib/hooks/useAppMutation'
import { cohortsApi } from '@/lib/api/cohorts'
import { queryKeys } from '@/lib/queryKeys'

function CreateCohortForm() {
  const createCohort = useAppMutation({
    mutationFn: (data: CohortFormData) => cohortsApi.create(data),
    invalidateQueries: [queryKeys.cohorts.lists()],
    successMessage: 'Cohort created successfully',
    onSuccess: () => {
      router.push('/admin/cohorts')
    },
  })

  const handleSubmit = (data: CohortFormData) => {
    createCohort.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button disabled={createCohort.isPending}>
        {createCohort.isPending ? 'Creating...' : 'Create'}
      </button>
    </form>
  )
}
```

### Mutation Options

- `mutationFn`: The async function that performs the API call
- `invalidateQueries`: Array of query keys to invalidate on success
- `successMessage`: Toast message to show on success (string or function)
- `errorMessage`: Override default error message
- `optimisticUpdate`: Function that returns a rollback function for optimistic updates
- `onSuccess`: Callback after successful mutation
- `onError`: Callback after failed mutation

## API Client

All API calls go through the centralized `apiClient` in `lib/api/client.ts`. API-specific wrappers are in `lib/api/`:

- `lib/api/cohorts.ts` - Cohort operations
- `lib/api/goals.ts` - Goal template and startup goal operations

```typescript
import { cohortsApi } from '@/lib/api/cohorts'

// These are typed and handle errors consistently
const cohorts = await cohortsApi.getAll()
const cohort = await cohortsApi.getBySlug('cohort-12')
const newCohort = await cohortsApi.create(formData)
```

## Realtime Updates

Supabase Realtime is automatically set up via `RealtimeProvider` in the app layout. It subscribes to database changes and invalidates relevant query caches.

### How It Works

1. Realtime subscriptions listen to `INSERT`, `UPDATE`, and `DELETE` events on key tables
2. When changes occur, the corresponding TanStack Query cache is invalidated
3. Components automatically refetch fresh data
4. UI updates without manual refresh

### Supported Tables

- `cohorts` - Updates cohort lists and details
- `goal_templates` - Updates admin goal templates
- `startup_goals` - Updates founder goals

## Caching Strategy

### Stale Times

- **Cohorts**: 10 minutes (rarely change, realtime handles updates)
- **Goals (Admin)**: 5 minutes (default)
- **Goals (Founder)**: 1 minute (can change more frequently)

### Cache Invalidation

Cache invalidation happens automatically:

- After mutations via `invalidateQueries` in `useAppMutation`
- Via Supabase Realtime subscriptions
- On window focus (if data is stale)

## Best Practices

1. **Always use query keys from `queryKeys.ts`** - Don't create ad-hoc keys
2. **Use `useAppMutation` for mutations** - Ensures consistent UX
3. **Invalidate related queries** - When creating/updating, invalidate both list and detail queries
4. **Handle loading and error states** - Always show appropriate UI states
5. **Use optimistic updates sparingly** - Only when rollback is straightforward

## Example: Complete CRUD Flow

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppMutation } from '@/lib/hooks/useAppMutation'
import { queryKeys } from '@/lib/queryKeys'
import { cohortsApi } from '@/lib/api/cohorts'

export function CohortsPage() {
  // Fetch list
  const { data: cohorts, isLoading } = useQuery({
    queryKey: queryKeys.cohorts.lists(),
    queryFn: () => cohortsApi.getAll(),
  })

  // Delete mutation
  const deleteCohort = useAppMutation({
    mutationFn: (slug: string) => cohortsApi.delete(slug),
    invalidateQueries: [queryKeys.cohorts.lists()],
    successMessage: 'Cohort deleted successfully',
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      {cohorts?.map(cohort => (
        <div key={cohort.id}>
          {cohort.label}
          <button
            onClick={() => deleteCohort.mutate(cohort.slug)}
            disabled={deleteCohort.isPending}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}
```

## Troubleshooting

### Data not updating after mutation

- Check that `invalidateQueries` includes the correct query keys
- Verify the mutation succeeded (check network tab)
- Ensure RealtimeProvider is mounted in the app layout

### Realtime not working

- Check browser console for subscription errors
- Verify Supabase Realtime is enabled for the table
- Check that RLS policies allow the subscription

### Stale data

- Reduce `staleTime` for frequently changing data
- Use `refetchInterval` for polling fallback
- Ensure Realtime subscriptions are active
