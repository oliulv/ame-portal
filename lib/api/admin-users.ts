import { apiClient } from './client'

export const adminUsersApi = {
  /**
   * Remove an admin from a cohort
   */
  removeFromCohort: async (userId: string, cohortId: string): Promise<void> => {
    return apiClient.delete(`/api/admin/users/${userId}/cohorts/${cohortId}`)
  },
}

