import { apiClient } from './client'

export interface DashboardStats {
  cohortsCount: number
  startupsCount: number
  invoicesCount: number
}

export const dashboardApi = {
  /**
   * Fetch dashboard statistics
   * @param cohortSlug Optional cohort slug to filter stats by cohort
   */
  getStats: async (cohortSlug?: string): Promise<DashboardStats> => {
    const url = cohortSlug 
      ? `/api/admin/dashboard?cohort_slug=${cohortSlug}`
      : '/api/admin/dashboard'
    return apiClient.get<DashboardStats>(url)
  },
}

