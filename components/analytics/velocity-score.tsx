'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'

interface VelocityScoreProps {
  commits: number
  prsOpened: number
  prsMerged: number
  reviews: number
  totalScore: number
}

const BARS = [
  { key: 'Commits', points: 10, cssVar: '--chart-1' },
  { key: 'PRs Opened', points: 25, cssVar: '--chart-2' },
  { key: 'PRs Merged', points: 50, cssVar: '--chart-3' },
  { key: 'Reviews', points: 30, cssVar: '--chart-4' },
]

export function VelocityScore({
  commits,
  prsOpened,
  prsMerged,
  reviews,
  totalScore,
}: VelocityScoreProps) {
  const data = [
    { name: 'Commits', count: commits, points: commits * 10, color: 'hsl(var(--chart-1))' },
    {
      name: 'PRs Opened',
      count: prsOpened,
      points: prsOpened * 25,
      color: 'hsl(var(--chart-2))',
    },
    {
      name: 'PRs Merged',
      count: prsMerged,
      points: prsMerged * 50,
      color: 'hsl(var(--chart-3))',
    },
    { name: 'Reviews', count: reviews, points: reviews * 30, color: 'hsl(var(--chart-4))' },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Git Velocity</CardTitle>
          <span className="text-2xl font-bold">{totalScore} pts</span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" barCategoryGap="20%">
            <defs>
              {BARS.map((bar) => (
                <linearGradient
                  key={bar.key}
                  id={`vel-grad-${bar.key.replace(/\s/g, '-')}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="0%" stopColor={`hsl(var(${bar.cssVar}))`} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={`hsl(var(${bar.cssVar}))`} stopOpacity={1} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
            <Tooltip
              formatter={(value: number, _name: string, props: any) => [
                `${props.payload.count} (${value} pts)`,
                '',
              ]}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="points" animationDuration={500} radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={`url(#vel-grad-${entry.name.replace(/\s/g, '-')})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {BARS.map((bar) => (
            <span key={bar.key} className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: `hsl(var(${bar.cssVar}))` }}
              />
              {bar.key}: {bar.points}pts each
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
