'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ContributionDay {
  date: string
  contributionCount: number
}

interface ContributionWeek {
  contributionDays: ContributionDay[]
}

interface ContributionCalendarProps {
  weeks: ContributionWeek[]
}

// GitHub's exact contribution graph colors
const COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']

function colorFor(count: number): string {
  if (count === 0) return COLORS[0]
  if (count <= 3) return COLORS[1]
  if (count <= 8) return COLORS[2]
  if (count <= 15) return COLORS[3]
  return COLORS[4]
}

export function ContributionCalendar({ weeks }: ContributionCalendarProps) {
  // Filter to only weeks that have actual day data
  const validWeeks = useMemo(() => weeks.filter((w) => w.contributionDays.length > 0), [weeks])

  const totalContributions = useMemo(
    () =>
      validWeeks.reduce(
        (sum, week) =>
          sum + week.contributionDays.reduce((wSum, day) => wSum + day.contributionCount, 0),
        0
      ),
    [validWeeks]
  )

  // Build month labels from actual data dates
  const monthLabels = useMemo(() => {
    const labels: { label: string; colStart: number }[] = []
    let lastMonth = -1
    validWeeks.forEach((week, wi) => {
      const firstDay = week.contributionDays[0]
      if (!firstDay) return
      const d = new Date(firstDay.date)
      const m = d.getMonth()
      if (m !== lastMonth) {
        labels.push({
          label: d.toLocaleString('en-US', { month: 'short' }),
          colStart: wi + 2, // +2 because col 1 is the day labels
        })
        lastMonth = m
      }
    })
    return labels
  }, [validWeeks])

  if (validWeeks.length === 0) return null

  const scoringWeekCount = Math.min(4, validWeeks.length)
  const cols = validWeeks.length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Contributions</CardTitle>
          <span className="text-sm text-muted-foreground tabular-nums">
            {totalContributions} in the last {validWeeks.length} weeks
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={100}>
          {/*
            CSS Grid: 1 column for day labels + N columns for weeks.
            7 rows for days + 1 row for month labels on top.
            Columns use minmax(0, 1fr) so they shrink to fit without overflow.
          */}
          <div
            className="w-full"
            style={{
              display: 'grid',
              gridTemplateColumns: `28px repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `auto repeat(7, minmax(0, 1fr))`,
              gap: '2px',
            }}
          >
            {/* Month labels row */}
            {monthLabels.map((m, i) => {
              return (
                <div
                  key={i}
                  className="text-[11px] text-muted-foreground pb-1"
                  style={{
                    gridColumn: `${m.colStart} / ${m.colStart}`,
                    gridRow: 1,
                  }}
                >
                  {m.label}
                </div>
              )
            })}

            {/* Day-of-week labels (column 1, rows 2-8) */}
            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, row) => (
              <div
                key={row}
                className="text-[11px] text-muted-foreground text-right pr-1 flex items-center justify-end"
                style={{ gridColumn: 1, gridRow: row + 2 }}
              >
                {label}
              </div>
            ))}

            {/* Contribution cells */}
            {validWeeks.map((week, wi) => {
              const isScoring = wi >= validWeeks.length - scoringWeekCount
              return week.contributionDays.map((day, di) => (
                <Tooltip key={day.date}>
                  <TooltipTrigger asChild>
                    <div
                      className="rounded-sm w-full h-full min-h-[8px]"
                      style={{
                        gridColumn: wi + 2,
                        gridRow: di + 2,
                        backgroundColor: colorFor(day.contributionCount),
                        outline: isScoring ? '1px solid rgba(16,185,129,0.2)' : undefined,
                        outlineOffset: '-1px',
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <span className="font-medium">
                      {day.contributionCount} contribution
                      {day.contributionCount !== 1 ? 's' : ''}
                    </span>{' '}
                    on{' '}
                    {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TooltipContent>
                </Tooltip>
              ))
            })}
          </div>
        </TooltipProvider>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-0.5">
              {COLORS.map((color, i) => (
                <div
                  key={i}
                  className="h-[11px] w-[11px] rounded-sm"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <span>More</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Last {scoringWeekCount} weeks count towards scoring
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
