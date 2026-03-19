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

const POINT_VALUES = {
  Commits: { points: 10, color: '#22c55e' },
  'PRs Opened': { points: 25, color: '#3b82f6' },
  'PRs Merged': { points: 50, color: '#8b5cf6' },
  Reviews: { points: 30, color: '#f59e0b' },
}

export function VelocityScore({
  commits,
  prsOpened,
  prsMerged,
  reviews,
  totalScore,
}: VelocityScoreProps) {
  const data = [
    { name: 'Commits', count: commits, points: commits * 10, color: '#22c55e' },
    { name: 'PRs Opened', count: prsOpened, points: prsOpened * 25, color: '#3b82f6' },
    { name: 'PRs Merged', count: prsMerged, points: prsMerged * 50, color: '#8b5cf6' },
    { name: 'Reviews', count: reviews, points: reviews * 30, color: '#f59e0b' },
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
              {data.map((entry) => (
                <linearGradient
                  key={entry.name}
                  id={`bar-grad-${entry.name.replace(/\s/g, '-')}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="0%" stopColor={entry.color} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={1} />
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
                <Cell key={entry.name} fill={`url(#bar-grad-${entry.name.replace(/\s/g, '-')})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {Object.entries(POINT_VALUES).map(([name, { points, color }]) => (
            <span key={name} className="flex items-center gap-1">
              <span className="h-2 w-2" style={{ backgroundColor: color }} />
              {name}: {points}pts each
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
