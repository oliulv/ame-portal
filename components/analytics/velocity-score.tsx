'use client'

import { useMemo } from 'react'
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
  Legend,
} from 'recharts'

const FOUNDER_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5, 280 65% 60%))',
]

interface VelocityScoreProps {
  commits: number
  prsOpened: number
  totalScore: number
  /** Per-founder stats: { [name]: { commits, prs } } */
  perFounderStats?: Record<string, { commits: number; prs: number }>
}

const BARS = [
  { key: 'Commits', points: 10, color: 'hsl(var(--primary))' },
  { key: 'PRs', points: 25, color: 'hsl(var(--primary) / 0.7)' },
]

export function VelocityScore({
  commits,
  prsOpened,
  totalScore,
  perFounderStats,
}: VelocityScoreProps) {
  const rawTotal = commits * 10 + prsOpened * 25
  const decayPct = rawTotal > 0 ? Math.round(((rawTotal - totalScore) / rawTotal) * 100) : 0

  const founderNames = useMemo(
    () => (perFounderStats ? Object.keys(perFounderStats) : []),
    [perFounderStats]
  )
  const isMultiFounder = founderNames.length > 1

  // Stacked bar data for multi-founder mode
  const stackedData = useMemo(() => {
    if (!isMultiFounder || !perFounderStats) return null

    const commitsRow: Record<string, string | number> = { name: 'Commits' }
    const prsRow: Record<string, string | number> = { name: 'PRs' }
    for (const [name, stats] of Object.entries(perFounderStats)) {
      commitsRow[name] = stats.commits * 10
      prsRow[name] = stats.prs * 25
    }
    return [commitsRow, prsRow]
  }, [isMultiFounder, perFounderStats])

  // Single-founder data
  const singleData = [
    { name: 'Commits', count: commits, points: commits * 10 },
    { name: 'PRs', count: prsOpened, points: prsOpened * 25 },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Git Velocity</CardTitle>
            <p className="text-xs text-muted-foreground">Last 4 weeks with temporal decay</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold font-display tabular-nums">
              {totalScore.toLocaleString()} pts
            </span>
            {decayPct > 0 && (
              <p className="text-xs text-muted-foreground">
                {rawTotal.toLocaleString()} raw &minus; {decayPct}% decay
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isMultiFounder && stackedData ? (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stackedData} layout="vertical" barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                  width={70}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} pts`, `@${name}`]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0px',
                    fontSize: '12px',
                  }}
                />
                <Legend formatter={(value) => `@${value}`} wrapperStyle={{ fontSize: '11px' }} />
                {founderNames.map((name, i) => (
                  <Bar
                    key={name}
                    dataKey={name}
                    stackId="a"
                    fill={FOUNDER_COLORS[i % FOUNDER_COLORS.length]}
                    animationDuration={400}
                    radius={i === founderNames.length - 1 ? [0, 3, 3, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-5 text-xs text-muted-foreground">
                {BARS.map((bar) => (
                  <span key={bar.key}>
                    {bar.key} ({bar.points}pts)
                  </span>
                ))}
              </div>
              {decayPct > 0 && (
                <p className="text-xs text-muted-foreground">Older activity decays ~19%/week</p>
              )}
            </div>
          </>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={singleData} layout="vertical" barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
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
                    return [`${props.payload.count} × ${bar?.points ?? 0} = ${value} pts (raw)`, '']
                  }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="points" animationDuration={400} radius={[0, 3, 3, 0]}>
                  {singleData.map((_, i) => (
                    <Cell key={i} fill={BARS[i].color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-5 text-xs text-muted-foreground">
                {BARS.map((bar) => (
                  <span key={bar.key} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: bar.color }}
                    />
                    {bar.key} ({bar.points}pts)
                  </span>
                ))}
              </div>
              {decayPct > 0 && (
                <p className="text-xs text-muted-foreground">Older activity decays ~19%/week</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
