'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface RedirectHandlerProps {
  to: string
  fallback?: React.ReactNode
}

export function RedirectHandler({ to, fallback }: RedirectHandlerProps) {
  const router = useRouter()

  useEffect(() => {
    // Force a client-side redirect as a fallback
    router.replace(to)
  }, [router, to])

  return (
    fallback || (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Redirecting...</div>
      </div>
    )
  )
}
