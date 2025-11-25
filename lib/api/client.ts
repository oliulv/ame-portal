/**
 * Centralized API client for making requests to our API routes
 *
 * Provides typed wrappers around fetch with consistent error handling
 */

export interface ApiError {
  error: string
  details?: unknown
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: ApiError
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiError | undefined
    try {
      errorData = await response.json()
    } catch {
      // If response isn't JSON, use status text
    }

    throw new ApiClientError(
      errorData?.error || response.statusText || 'Request failed',
      response.status,
      errorData
    )
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    return undefined as T
  }

  return response.json()
}

export const apiClient = {
  /**
   * GET request
   */
  async get<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    return handleResponse<T>(response)
  },

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    })

    return handleResponse<T>(response)
  },

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    })

    return handleResponse<T>(response)
  },

  /**
   * DELETE request
   */
  async delete<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    return handleResponse<T>(response)
  },
}
