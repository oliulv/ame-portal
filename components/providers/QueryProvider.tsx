'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/queryClient'
import { Toaster } from 'sonner'
import { RealtimeProvider } from './RealtimeProvider'
import dynamic from 'next/dynamic'

// Dynamically import devtools only in development and client-side
const ReactQueryDevtools = process.env.NODE_ENV === 'development'
  ? dynamic(() => import('@tanstack/react-query-devtools').then((mod) => mod.ReactQueryDevtools), {
      ssr: false,
    })
  : () => null

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        {children}
      </RealtimeProvider>
      <Toaster position="top-right" richColors />
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}

