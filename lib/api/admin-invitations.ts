import { AdminInvitation } from '@/lib/types'

const API_BASE = '/api/admin/admin-invitations'

export const adminInvitationsApi = {
  /**
   * List admin invitations
   * @param cohortId Optional cohort ID to filter invitations
   */
  async list(cohortId?: string): Promise<AdminInvitation[]> {
    const url = cohortId ? `${API_BASE}?cohort_id=${cohortId}` : API_BASE
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch admin invitations' }))
      throw new Error(error.error || 'Failed to fetch admin invitations')
    }

    return response.json()
  },

  /**
   * Create a new admin invitation
   */
  async create(data: {
    email: string
    invited_name?: string
    expires_in_days?: number
    cohort_id: string
  }): Promise<AdminInvitation> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create admin invitation' }))
      throw new Error(error.error || 'Failed to create admin invitation')
    }

    return response.json()
  },

  /**
   * Resend an admin invitation email
   */
  async resend(invitationId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${invitationId}/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to resend invitation' }))
      throw new Error(error.error || 'Failed to resend invitation')
    }
  },

  /**
   * Revoke an admin invitation
   */
  async revoke(invitationId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${invitationId}/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to revoke invitation' }))
      throw new Error(error.error || 'Failed to revoke invitation')
    }
  },
}

