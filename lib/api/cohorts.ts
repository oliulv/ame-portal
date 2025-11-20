import { apiClient } from './client'
import { Cohort } from '@/lib/types'
import { cohortSchema, type CohortFormData } from '@/lib/schemas'

export const cohortsApi = {
  /**
   * Fetch all cohorts
   */
  getAll: async (): Promise<Cohort[]> => {
    return apiClient.get<Cohort[]>('/api/admin/cohorts')
  },

  /**
   * Fetch a single cohort by slug
   */
  getBySlug: async (slug: string): Promise<Cohort> => {
    return apiClient.get<Cohort>(`/api/admin/cohorts/${slug}`)
  },

  /**
   * Create a new cohort
   */
  create: async (data: CohortFormData): Promise<Cohort> => {
    return apiClient.post<Cohort>('/api/admin/cohorts', data)
  },

  /**
   * Update a cohort
   */
  update: async (slug: string, data: CohortFormData): Promise<Cohort> => {
    return apiClient.patch<Cohort>(`/api/admin/cohorts/${slug}`, data)
  },
}

