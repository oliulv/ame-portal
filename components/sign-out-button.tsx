'use client'

import { SignOutButton as ClerkSignOutButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

interface SignOutButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary'
  className?: string
  children?: React.ReactNode
}

export function SignOutButton({
  variant = 'outline',
  className = 'w-full',
  children,
}: SignOutButtonProps) {
  return (
    <ClerkSignOutButton
      signOutCallback={() => {
        // Force a hard redirect after sign out
        window.location.href = '/login'
      }}
    >
      <Button variant={variant} className={className}>
        {children || 'Sign Out and Switch Account'}
      </Button>
    </ClerkSignOutButton>
  )
}

