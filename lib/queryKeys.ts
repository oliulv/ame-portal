/**
 * Centralized query keys for TanStack Query
 *
 * This ensures consistent key structure across the app and makes
 * cache invalidation predictable.
 */

export const queryKeys = {
  // Cohorts
  cohorts: {
    all: ['cohorts'] as const,
    lists: () => [...queryKeys.cohorts.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.cohorts.lists(), filters] as const,
    details: () => [...queryKeys.cohorts.all, 'detail'] as const,
    detail: (slug: string) => [...queryKeys.cohorts.details(), slug] as const,
  },

  // Goals
  goals: {
    all: ['goals'] as const,
    lists: () => [...queryKeys.goals.all, 'list'] as const,
    list: (scope: 'admin' | 'founder', filters?: Record<string, unknown>) =>
      [...queryKeys.goals.lists(), scope, filters] as const,
    details: () => [...queryKeys.goals.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.goals.details(), id] as const,
  },

  // Startups
  startups: {
    all: ['startups'] as const,
    lists: () => [...queryKeys.startups.all, 'list'] as const,
    list: (cohortSlug?: string, filters?: Record<string, unknown>) =>
      [...queryKeys.startups.lists(), cohortSlug, filters] as const,
    details: () => [...queryKeys.startups.all, 'detail'] as const,
    detail: (slugOrId: string) => [...queryKeys.startups.details(), slugOrId] as const,
  },

  // Invoices
  invoices: {
    all: ['invoices'] as const,
    lists: () => [...queryKeys.invoices.all, 'list'] as const,
    list: (role: 'admin' | 'founder', filters?: Record<string, unknown>) =>
      [...queryKeys.invoices.lists(), role, filters] as const,
    details: () => [...queryKeys.invoices.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.invoices.details(), id] as const,
  },

  // Invitations
  invitations: {
    all: ['invitations'] as const,
    lists: () => [...queryKeys.invitations.all, 'list'] as const,
    list: (startupId?: string) => [...queryKeys.invitations.lists(), startupId] as const,
    details: () => [...queryKeys.invitations.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.invitations.details(), id] as const,
  },

  // Leaderboard
  leaderboard: {
    all: ['leaderboard'] as const,
    list: (cohortSlug?: string) => [...queryKeys.leaderboard.all, cohortSlug] as const,
  },

  // Admin Invitations
  adminInvitations: {
    all: ['adminInvitations'] as const,
    lists: () => [...queryKeys.adminInvitations.all, 'list'] as const,
    list: (cohortId?: string) => [...queryKeys.adminInvitations.lists(), cohortId] as const,
    details: () => [...queryKeys.adminInvitations.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.adminInvitations.details(), id] as const,
  },
} as const
