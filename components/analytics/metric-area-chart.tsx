'use client'

import { useMemo } from 'react'
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
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
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

/** Per-founder series: { [founderName]: { timestamp, value }[] } */
type MultiSeries = Record<string, Array<{ timestamp: string; value: number }>>

const FOUNDER_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--primary) / 0.55)',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
]

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
  /** Per-founder series for multi-line mode */
  multiSeries?: MultiSeries
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
  multiSeries,
}: MetricAreaChartProps) {
  const hasComparison = data.some((d) => d.compareValue !== undefined)
  const gradientId = `grad-${title.replace(/[^a-zA-Z0-9]/g, '-')}`
  const hasRangeSelector = range !== undefined && onRangeChange && rangeOptions

  // Multi-line mode: merge per-founder series into unified data points
  const founderNames = useMemo(() => (multiSeries ? Object.keys(multiSeries) : []), [multiSeries])
  const isMultiLine = founderNames.length > 1

  const multiLineData = useMemo(() => {
    if (!isMultiLine || !multiSeries) return []

    // Collect all timestamps across all founders
    const timestampSet = new Set<string>()
    for (const series of Object.values(multiSeries)) {
      for (const pt of series) timestampSet.add(pt.timestamp)
    }
    const timestamps = Array.from(timestampSet).sort()

    // Build lookup maps per founder
    const lookups = new Map<string, Map<string, number>>()
    for (const [name, series] of Object.entries(multiSeries)) {
      const map = new Map<string, number>()
      for (const pt of series) map.set(pt.timestamp, pt.value)
      lookups.set(name, map)
    }

    return timestamps.map((ts) => {
      const point: Record<string, string | number> = { timestamp: ts }
      for (const name of founderNames) {
        point[name] = lookups.get(name)?.get(ts) ?? 0
      }
      return point
    })
  }, [isMultiLine, multiSeries, founderNames])

  const headerContent = (
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
  )

  if ((!data || data.length === 0) && multiLineData.length === 0) {
    return (
      <Card>
        {headerContent}
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  // Multi-line mode
  if (isMultiLine && multiLineData.length > 0) {
    return (
      <Card>
        {headerContent}
        <CardContent>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={multiLineData}>
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
                formatter={(value: number, name: string) => [formatValue(value), `@${name}`]}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0px',
                  fontSize: '12px',
                }}
              />
              <Legend formatter={(value) => `@${value}`} wrapperStyle={{ fontSize: '12px' }} />
              {founderNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={FOUNDER_COLORS[i % FOUNDER_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={500}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    )
  }

  // Single-line area chart (default)
  return (
    <Card>
      {headerContent}
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
