'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface UserSetupRetryProps {
  isInternalServerError?: boolean
}

export function UserSetupRetry({ isInternalServerError = false }: UserSetupRetryProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRetry = async () => {
    setIsRetrying(true)
    setError(null)

    try {
      const response = await fetch('/api/user/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        // Show more detailed error message if available
        const errorMsg = data.error || data.details || 'Failed to setup account'
        const troubleshooting = data.troubleshooting ? `\n\n${data.troubleshooting}` : ''
        throw new Error(errorMsg + troubleshooting)
      }

      // Success - reload the page
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setIsRetrying(false)
    }
  }

  return (
    <Card className="max-w-md w-full">
      <CardHeader>
        <CardTitle>Account Setup Required</CardTitle>
        <CardDescription>
          Your account is authenticated but not yet set up in our system.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This usually happens automatically. If you're seeing this message, the automatic setup may
          have failed.
        </p>
        {isInternalServerError && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
            <p className="text-sm text-yellow-700 dark:text-yellow-400 font-semibold mb-1">
              Stale Session Detected
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              This error often occurs due to stale authentication cookies. Try clearing your browser
              cookies and local storage, then sign in again.
            </p>
          </div>
        )}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive font-mono break-all">{error}</p>
          </div>
        )}
        <Button onClick={handleRetry} disabled={isRetrying} className="w-full">
          {isRetrying ? 'Setting up...' : 'Retry Account Setup'}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          {isInternalServerError ? (
            <>
              If retry doesn't work, try clearing cookies/local storage and signing in again.
              <br />
              Or refresh the page
            </>
          ) : (
            'Or try refreshing the page'
          )}
        </p>
      </CardContent>
    </Card>
  )
}
