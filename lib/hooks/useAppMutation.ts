import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiClientError } from '@/lib/api/client'

export interface UseAppMutationOptions<TData, TVariables, TContext = unknown> {
  /**
   * Mutation function that performs the API call
   */
  mutationFn: (variables: TVariables) => Promise<TData>
  
  /**
   * Query keys to invalidate on success
   */
  invalidateQueries?: Array<readonly unknown[]>
  
  /**
   * Optimistic update function
   * Receives variables and returns a rollback function
   */
  optimisticUpdate?: (variables: TVariables) => () => void
  
  /**
   * Success message to show in toast
   */
  successMessage?: string | ((data: TData) => string)
  
  /**
   * Error message override
   */
  errorMessage?: string
  
  /**
   * Whether to show loading toast
   */
  showLoadingToast?: boolean
  
  /**
   * Loading message
   */
  loadingMessage?: string
  
  /**
   * Callback on success
   */
  onSuccess?: (data: TData, variables: TVariables) => void
  
  /**
   * Callback on error
   */
  onError?: (error: Error, variables: TVariables) => void
  
  /**
   * Additional TanStack Query mutation options
   */
  mutationOptions?: Omit<UseMutationOptions<TData, Error, TVariables, TContext>, 'mutationFn' | 'onSuccess' | 'onError'>
}

/**
 * Enhanced mutation hook with built-in toast notifications and cache management
 */
export function useAppMutation<TData, TVariables, TContext = unknown>(
  options: UseAppMutationOptions<TData, TVariables, TContext>
) {
  const queryClient = useQueryClient()
  const {
    mutationFn,
    invalidateQueries = [],
    optimisticUpdate,
    successMessage,
    errorMessage,
    showLoadingToast = false,
    loadingMessage = 'Processing...',
    onSuccess,
    onError,
    mutationOptions,
  } = options

  let rollbackFn: (() => void) | undefined

  return useMutation<TData, Error, TVariables, TContext>({
    ...mutationOptions,
    mutationFn: async (variables) => {
      // Show loading toast if requested
      if (showLoadingToast) {
        toast.loading(loadingMessage, { id: 'mutation-loading' })
      }

      // Apply optimistic update if provided
      if (optimisticUpdate) {
        rollbackFn = optimisticUpdate(variables)
      }

      try {
        const result = await mutationFn(variables)
        return result
      } catch (error) {
        // Rollback optimistic update on error
        if (rollbackFn) {
          rollbackFn()
        }
        throw error
      }
    },
    onSuccess: (data, variables, context) => {
      // Dismiss loading toast
      if (showLoadingToast) {
        toast.dismiss('mutation-loading')
      }

      // Invalidate queries
      invalidateQueries.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey })
      })

      // Show success toast
      if (successMessage) {
        const message = typeof successMessage === 'function' 
          ? successMessage(data) 
          : successMessage
        toast.success(message)
      }

      // Call user's onSuccess callback
      onSuccess?.(data, variables)
    },
    onError: (error, variables, context) => {
      // Dismiss loading toast
      if (showLoadingToast) {
        toast.dismiss('mutation-loading')
      }

      // Show error toast
      const message = error instanceof ApiClientError
        ? error.message
        : errorMessage || error.message || 'An error occurred'
      toast.error(message)

      // Call user's onError callback
      onError?.(error, variables)
    },
  })
}

