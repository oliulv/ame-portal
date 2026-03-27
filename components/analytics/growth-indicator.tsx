'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GrowthIndicatorProps {
  change: number // percentage
  label?: string
  size?: 'sm' | 'md'
}

export function GrowthIndicator({ change, label, size = 'sm' }: GrowthIndicatorProps) {
  const isPositive = change > 0
  const isNeutral = change === 0

  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'

  return (
    <span className={cn('inline-flex items-center gap-1', textSize)}>
      {isNeutral ? (
        <Minus className={cn(iconSize, 'text-muted-foreground')} />
      ) : isPositive ? (
        <TrendingUp className={cn(iconSize, 'text-green-600')} />
      ) : (
        <TrendingDown className={cn(iconSize, 'text-red-600')} />
      )}
      <span
        className={cn(
          'font-medium',
          isNeutral ? 'text-muted-foreground' : isPositive ? 'text-green-600' : 'text-red-600'
        )}
      >
        {isPositive ? '+' : ''}
        {change.toFixed(1)}%
      </span>
      {label && <span className="text-muted-foreground">{label}</span>}
    </span>
  )
}
