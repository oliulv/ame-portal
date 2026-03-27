'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'

interface MrrMovement {
  type: 'new' | 'expansion' | 'contraction' | 'churn' | 'reactivation'
  amount: number
}

interface MrrWaterfallProps {
  startingMrr: number
  movements: MrrMovement[]
  formatValue?: (value: number) => string
}

export function MrrWaterfall({
  startingMrr,
  movements,
  formatValue = (v) => `£${(v / 100).toLocaleString()}`,
}: MrrWaterfallProps) {
  const grouped = {
    new: movements.filter((m) => m.type === 'new').reduce((s, m) => s + m.amount, 0),
    expansion: movements.filter((m) => m.type === 'expansion').reduce((s, m) => s + m.amount, 0),
    reactivation: movements
      .filter((m) => m.type === 'reactivation')
      .reduce((s, m) => s + m.amount, 0),
    contraction: movements
      .filter((m) => m.type === 'contraction')
      .reduce((s, m) => s + m.amount, 0),
    churn: movements.filter((m) => m.type === 'churn').reduce((s, m) => s + m.amount, 0),
  }

  const endingMrr =
    startingMrr +
    grouped.new +
    grouped.expansion +
    grouped.reactivation -
    grouped.contraction -
    grouped.churn

  // Build waterfall data: invisible base + colored bar
  const data = [
    { name: 'Starting', value: startingMrr, base: 0, fill: 'hsl(var(--chart-1))' },
    { name: '+New', value: grouped.new, base: startingMrr, fill: '#22c55e' },
    {
      name: '+Expansion',
      value: grouped.expansion,
      base: startingMrr + grouped.new,
      fill: '#16a34a',
    },
    {
      name: '+Reactivation',
      value: grouped.reactivation,
      base: startingMrr + grouped.new + grouped.expansion,
      fill: '#15803d',
    },
    {
      name: '-Contraction',
      value: grouped.contraction,
      base: endingMrr + grouped.churn,
      fill: '#f87171',
    },
    { name: '-Churn', value: grouped.churn, base: endingMrr, fill: '#ef4444' },
    { name: 'Ending', value: endingMrr, base: 0, fill: 'hsl(var(--chart-1))' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">MRR Waterfall</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => formatValue(v)} tick={{ fontSize: 11 }} width={60} />
            <Tooltip
              formatter={(value: number) => [formatValue(value), '']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0px',
                fontSize: '12px',
              }}
            />
            {/* Invisible spacer bar */}
            <Bar dataKey="base" stackId="waterfall" fill="transparent" />
            {/* Actual value bar */}
            <Bar dataKey="value" stackId="waterfall" animationDuration={500}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
