import { apiClient } from './client'
import { GoalTemplate, StartupGoal } from '@/lib/types'
import { goalTemplateSchema, type GoalTemplateFormData } from '@/lib/schemas'

export interface GoalTemplateWithCohort extends GoalTemplate {
  cohorts?: {
    id: string
    label: string
  }
}

export const goalsApi = {
  /**
   * Fetch all goal templates (admin)
   */
  getAll: async (cohortId?: string): Promise<GoalTemplateWithCohort[]> => {
    const url = cohortId 
      ? `/api/admin/goals?cohort_id=${cohortId}`
      : '/api/admin/goals'
    return apiClient.get<GoalTemplateWithCohort[]>(url)
  },

  /**
   * Fetch a single goal template by ID
   */
  getById: async (id: string): Promise<GoalTemplateWithCohort> => {
    return apiClient.get<GoalTemplateWithCohort>(`/api/admin/goals/${id}`)
  },

  /**
   * Create a new goal template
   */
  create: async (data: GoalTemplateFormData): Promise<GoalTemplate> => {
    return apiClient.post<GoalTemplate>('/api/admin/goals', data)
  },

  /**
   * Update a goal template
   */
  update: async (id: string, data: Partial<GoalTemplateFormData>): Promise<GoalTemplate> => {
    return apiClient.patch<GoalTemplate>(`/api/admin/goals/${id}`, data)
  },

  /**
   * Delete a goal template
   */
  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/admin/goals/${id}`)
  },

  /**
   * Reorder goal templates
   */
  reorder: async (goalIds: string[]): Promise<void> => {
    return apiClient.patch('/api/admin/goals/reorder', { goalIds })
  },

  /**
   * Fetch founder goals
   */
  getFounderGoals: async (): Promise<StartupGoal[]> => {
    return apiClient.get<StartupGoal[]>('/api/founder/goals')
  },
}

