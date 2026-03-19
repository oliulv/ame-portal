'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts'

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
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} layout="vertical">
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
            <Bar dataKey="points" animationDuration={500}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
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
