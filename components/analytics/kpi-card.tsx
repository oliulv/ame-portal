'use client'

import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

interface KpiCardProps {
  title: string
  value: string
  change?: number // percentage change (e.g. 12.5 or -3.2)
  changeLabel?: string // e.g. "vs last week"
  subtitle?: string // optional clarifier rendered under the title
  sparklineData?: Array<{ value: number }>
  color?: string // CSS chart color variable like 'var(--chart-1)'
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel = 'vs last week',
  subtitle,
  sparklineData,
  color = 'var(--chart-1)',
}: KpiCardProps) {
  const isPositive = change !== undefined && change >= 0
  const gradientId = `sparkGrad-${title.replace(/[^a-zA-Z0-9]/g, '-')}`

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
            {change !== undefined && (
              <div className="flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                )}
                <span
                  className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}
                >
                  {isPositive ? '+' : ''}
                  {change.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">{changeLabel}</span>
              </div>
            )}
          </div>

          {sparklineData && sparklineData.length > 1 && (
            <div className="h-[30px] w-[80px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={1.5}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    animationDuration={500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
