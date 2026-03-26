'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface DataPoint {
  timestamp: string
  value: number
  compareValue?: number
}

interface RangeOption {
  value: string
  label: string
  disabled?: boolean
  disabledReason?: string
}

interface MetricAreaChartProps {
  title: string
  description?: string
  data: DataPoint[]
  color?: string
  compareColor?: string
  formatValue?: (value: number) => string
  height?: number
  range?: string
  onRangeChange?: (range: string) => void
  rangeOptions?: RangeOption[]
}

function defaultFormat(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toLocaleString()
}

export function MetricAreaChart({
  title,
  description,
  data,
  color = 'hsl(var(--chart-1))',
  compareColor = 'hsl(var(--chart-3))',
  formatValue = defaultFormat,
  height = 300,
  range,
  onRangeChange,
  rangeOptions,
}: MetricAreaChartProps) {
  const hasComparison = data.some((d) => d.compareValue !== undefined)
  const gradientId = `grad-${title.replace(/[^a-zA-Z0-9]/g, '-')}`
  const hasRangeSelector = range !== undefined && onRangeChange && rangeOptions

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            {hasRangeSelector && (
              <Select value={range} onValueChange={onRangeChange}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rangeOptions.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      disabled={opt.disabled}
                      title={opt.disabled ? opt.disabledReason : undefined}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {hasRangeSelector && (
            <Select value={range} onValueChange={onRangeChange}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rangeOptions.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    title={opt.disabled ? opt.disabledReason : undefined}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(v) => {
                const d = new Date(v)
                return `${d.getMonth() + 1}/${d.getDate()}`
              }}
              className="text-xs"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickFormatter={formatValue}
              className="text-xs"
              tick={{ fontSize: 11 }}
              width={55}
            />
            <Tooltip
              formatter={(value: number) => [formatValue(value), '']}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0px',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              animationDuration={500}
            />
            {hasComparison && (
              <Area
                type="monotone"
                dataKey="compareValue"
                stroke={compareColor}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
                dot={false}
                animationDuration={500}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
