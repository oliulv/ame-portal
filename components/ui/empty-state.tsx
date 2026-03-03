import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card } from './card'

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  noCard?: boolean
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  noCard = false,
  ...props
}: EmptyStateProps) {
  const content = (
    <>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      {description && <p className="mb-6 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div>{action}</div>}
    </>
  )

  if (noCard) {
    return (
      <div
        className={cn('flex flex-col items-center justify-center p-12 text-center', className)}
        {...props}
      >
        {content}
      </div>
    )
  }

  return (
    <Card
      className={cn('flex flex-col items-center justify-center p-12 text-center', className)}
      {...props}
    >
      {content}
    </Card>
  )
}
