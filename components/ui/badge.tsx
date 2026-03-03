import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-primary/30 bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-secondary-foreground/15 bg-secondary text-secondary-foreground',
        destructive:
          'border-destructive/30 bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        success:
          'border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:border-emerald-400/25',
        warning:
          'border-amber-600/25 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:border-amber-400/25',
        info: 'border-blue-600/25 bg-blue-500/10 text-blue-700 dark:text-blue-400 dark:border-blue-400/25',
        danger:
          'border-red-600/25 bg-red-500/10 text-red-700 dark:text-red-400 dark:border-red-400/25',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
