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

// GitHub-style contribution colors using inline styles for absolute control
// Less = faintest, More = most vivid/bright green
const CONTRIBUTION_COLORS = [
  '#ebedf0', // 0: light gray (no contributions)
  '#9be9a8', // 1-3: faint green
  '#40c463', // 4-8: medium green
  '#30a14e', // 9-15: strong green
  '#216e39', // 16+: darkest green
]

function getColorStyle(count: number): string {
  if (count === 0) return CONTRIBUTION_COLORS[0]
  if (count <= 3) return CONTRIBUTION_COLORS[1]
  if (count <= 8) return CONTRIBUTION_COLORS[2]
  if (count <= 15) return CONTRIBUTION_COLORS[3]
  return CONTRIBUTION_COLORS[4]
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
                              className={`rounded-sm ${
                                isInScoringWindow ? 'ring-1 ring-emerald-500/30' : ''
                              }`}
                              style={{
                                width: `${CELL_SIZE}px`,
                                height: `${CELL_SIZE}px`,
                                backgroundColor: getColorStyle(day.contributionCount),
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
              {CONTRIBUTION_COLORS.map((color, i) => (
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
