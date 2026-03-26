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

function getColor(count: number): string {
  if (count === 0) return 'bg-muted/50'
  if (count <= 3) return 'bg-emerald-200 dark:bg-emerald-900'
  if (count <= 8) return 'bg-emerald-400 dark:bg-emerald-700'
  if (count <= 15) return 'bg-emerald-600 dark:bg-emerald-500'
  return 'bg-emerald-800 dark:bg-emerald-400'
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const CELL_SIZE = 13
const GAP = 2

export function ContributionCalendar({ weeks }: ContributionCalendarProps) {
  const totalContributions = useMemo(
    () =>
      weeks.reduce(
        (sum, week) =>
          sum + week.contributionDays.reduce((wSum, day) => wSum + day.contributionCount, 0),
        0
      ),
    [weeks]
  )

  const monthLabels = useMemo(() => {
    if (!weeks || weeks.length === 0) return []
    const labels: { label: string; weekIndex: number }[] = []
    let lastMonth = ''
    weeks.forEach((week, wi) => {
      const firstDay = week.contributionDays[0]
      if (!firstDay) return
      const month = new Date(firstDay.date).toLocaleString('en-US', { month: 'short' })
      if (month !== lastMonth) {
        labels.push({ label: month, weekIndex: wi })
        lastMonth = month
      }
    })
    return labels
  }, [weeks])

  if (!weeks || weeks.length === 0) {
    return null
  }

  // Determine if we're showing the scoring window (last 4 weeks)
  const scoringWeekCount = Math.min(4, weeks.length)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Contributions</CardTitle>
          <span className="text-sm text-muted-foreground tabular-nums">
            {totalContributions} in the last {weeks.length} weeks
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={100}>
          <div className="overflow-x-auto">
            {/* Month labels */}
            <div className="flex" style={{ paddingLeft: '32px' }}>
              {monthLabels.map((m, i) => (
                <div
                  key={i}
                  className="text-[11px] text-muted-foreground"
                  style={{
                    position: 'relative',
                    left: `${m.weekIndex * (CELL_SIZE + GAP)}px`,
                    marginRight:
                      i < monthLabels.length - 1
                        ? `${((monthLabels[i + 1]?.weekIndex ?? m.weekIndex) - m.weekIndex) * (CELL_SIZE + GAP) - 30}px`
                        : '0',
                    width: '30px',
                  }}
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex mt-1">
              {/* Day labels */}
              <div
                className="shrink-0 flex flex-col mr-1"
                style={{ gap: `${GAP}px`, width: '28px' }}
              >
                {DAY_LABELS.map((label, i) => (
                  <div
                    key={i}
                    className="text-[11px] text-muted-foreground text-right pr-1"
                    style={{ height: `${CELL_SIZE}px`, lineHeight: `${CELL_SIZE}px` }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Week columns */}
              <div className="flex" style={{ gap: `${GAP}px` }}>
                {weeks.map((week, wi) => {
                  const isInScoringWindow = wi >= weeks.length - scoringWeekCount
                  return (
                    <div key={wi} className="flex flex-col" style={{ gap: `${GAP}px` }}>
                      {week.contributionDays.map((day) => (
                        <Tooltip key={day.date}>
                          <TooltipTrigger asChild>
                            <div
                              className={`rounded-sm ${getColor(day.contributionCount)} ${
                                isInScoringWindow ? 'ring-1 ring-emerald-500/20' : ''
                              }`}
                              style={{
                                width: `${CELL_SIZE}px`,
                                height: `${CELL_SIZE}px`,
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <span className="font-medium">
                              {day.contributionCount} contribution
                              {day.contributionCount !== 1 ? 's' : ''}
                            </span>{' '}
                            on{' '}
                            {new Date(day.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </TooltipProvider>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-0.5">
              <div className="h-[11px] w-[11px] rounded-sm bg-muted/50" />
              <div className="h-[11px] w-[11px] rounded-sm bg-emerald-200 dark:bg-emerald-900" />
              <div className="h-[11px] w-[11px] rounded-sm bg-emerald-400 dark:bg-emerald-700" />
              <div className="h-[11px] w-[11px] rounded-sm bg-emerald-600 dark:bg-emerald-500" />
              <div className="h-[11px] w-[11px] rounded-sm bg-emerald-800 dark:bg-emerald-400" />
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
