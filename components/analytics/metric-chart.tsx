'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format } from 'date-fns'

interface MetricDataPoint {
  timestamp: string
  value: number
}

interface MetricChartProps {
  title: string
  description?: string
  data: MetricDataPoint[]
  dataKey?: string
  color?: string
  formatValue?: (value: number) => string
}

export function MetricChart({
  title,
  description,
  data,
  dataKey = 'value',
  color = 'hsl(var(--primary))',
  formatValue = (v) => v.toLocaleString(),
}: MetricChartProps) {
  // Format data for chart
  const chartData = data.map((point) => ({
    date: format(new Date(point.timestamp), 'MMM dd'),
    value: point.value,
    fullDate: point.timestamp,
  }))

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={formatValue}
            />
            <Tooltip
              formatter={(value: number) => formatValue(value)}
              labelFormatter={(label) => {
                const point = chartData.find((d) => d.date === label)
                return point ? format(new Date(point.fullDate), 'PPp') : label
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              name={title}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

