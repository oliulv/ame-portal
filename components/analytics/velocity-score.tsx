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
import type { VelocityBreakdown } from '@/convex/lib/scoring'

const FOUNDER_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--primary) / 0.55)',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
]

interface VelocityScoreProps {
  breakdown: VelocityBreakdown | null
  perFounderBreakdown?: Record<string, VelocityBreakdown> | null
}

const BARS = [
  { key: 'Commits' as const, weight: 10, color: 'hsl(var(--primary))' },
  { key: 'PRs' as const, weight: 25, color: 'hsl(var(--primary) / 0.7)' },
  { key: 'Issues' as const, weight: 15, color: 'hsl(var(--chart-2))' },
]

type BarKey = (typeof BARS)[number]['key']

function getBarValue(breakdown: VelocityBreakdown, key: BarKey) {
  if (key === 'Commits') return breakdown.commits
  if (key === 'PRs') return breakdown.prs
  return breakdown.issues
}

export function VelocityScore({ breakdown, perFounderBreakdown }: VelocityScoreProps) {
  const totalScore = breakdown?.total ?? 0
  const rawTotal = breakdown?.rawTotal ?? 0
  const decayPct = rawTotal > 0 ? Math.round(((rawTotal - totalScore) / rawTotal) * 100) : 0

  const founderNames = useMemo(
    () => (perFounderBreakdown ? Object.keys(perFounderBreakdown) : []),
    [perFounderBreakdown]
  )
  const isMultiFounder = founderNames.length > 1

  const activeBars = useMemo(
    () =>
      breakdown
        ? BARS.filter((bar) => getBarValue(breakdown, bar.key).points > 0)
        : BARS.slice(0, 2),
    [breakdown]
  )

  const chartHeight = activeBars.length <= 2 ? 160 : isMultiFounder ? 220 : 200

  const stackedData = useMemo(() => {
    if (!isMultiFounder || !perFounderBreakdown) return null
    return activeBars.map((bar) => {
      const row: Record<string, string | number> = { name: bar.key }
      for (const [name, bd] of Object.entries(perFounderBreakdown)) {
        row[name] = getBarValue(bd, bar.key).points
      }
      return row
    })
  }, [isMultiFounder, perFounderBreakdown, activeBars])

  const singleData = useMemo(
    () =>
      breakdown
        ? activeBars.map((bar) => {
            const val = getBarValue(breakdown, bar.key)
            return { name: bar.key, count: val.count, points: val.points }
          })
        : [],
    [breakdown, activeBars]
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Git Velocity</CardTitle>
            <p className="text-xs text-muted-foreground">Last 4 weeks (decay-adjusted)</p>
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
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={stackedData} layout="vertical" barCategoryGap="20%">
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

            <div className="mt-3 flex gap-5 text-xs text-muted-foreground">
              {activeBars.map((bar) => (
                <span key={bar.key}>
                  {bar.key} ({bar.weight}pts)
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={singleData} layout="vertical" barCategoryGap="20%">
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
                    return [`${value} pts (${props.payload.count} items, decayed)`, '']
                  }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="points" animationDuration={400} radius={[0, 3, 3, 0]}>
                  {singleData.map((entry, i) => {
                    const barDef = activeBars.find((b) => b.key === entry.name)
                    return <Cell key={i} fill={barDef?.color ?? 'hsl(var(--primary))'} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-3 flex gap-5 text-xs text-muted-foreground">
              {activeBars.map((bar) => (
                <span key={bar.key} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: bar.color }} />
                  {bar.key} ({bar.weight}pts)
                </span>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
