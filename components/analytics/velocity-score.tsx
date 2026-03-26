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
  reviews: number
  totalScore: number
}

const BARS = [
  { key: 'Commits', points: 10, color: 'hsl(var(--primary))' },
  { key: 'PRs', points: 25, color: 'hsl(var(--primary) / 0.7)' },
  { key: 'Reviews', points: 30, color: 'hsl(var(--primary) / 0.5)' },
]

export function VelocityScore({ commits, prsOpened, reviews, totalScore }: VelocityScoreProps) {
  const data = [
    { name: 'Commits', count: commits, points: commits * 10 },
    { name: 'PRs', count: prsOpened, points: prsOpened * 25 },
    { name: 'Reviews', count: reviews, points: reviews * 30 },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Git Velocity</CardTitle>
            <p className="text-xs text-muted-foreground">Last 4 weeks</p>
          </div>
          <span className="text-2xl font-bold font-display tabular-nums">{totalScore} pts</span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} layout="vertical" barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
              width={70}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number, _name: string, props: any) => {
                const bar = BARS.find((b) => b.key === props.payload.name)
                return [`${props.payload.count} × ${bar?.points ?? 0} = ${value} pts`, '']
              }}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0px',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="points" animationDuration={400} radius={[0, 3, 3, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={BARS[i].color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-3 flex gap-5 text-xs text-muted-foreground">
          {BARS.map((bar) => (
            <span key={bar.key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: bar.color }} />
              {bar.key} ({bar.points}pts)
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
