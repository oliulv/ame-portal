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
  if (count === 0) return 'bg-muted'
  if (count <= 2) return 'bg-green-200 dark:bg-green-900'
  if (count <= 5) return 'bg-green-400 dark:bg-green-700'
  if (count <= 10) return 'bg-green-600 dark:bg-green-500'
  return 'bg-green-800 dark:bg-green-400'
}

const DAY_LABELS = ['', 'M', '', 'W', '', 'F', '']

export function ContributionCalendar({ weeks }: ContributionCalendarProps) {
  const monthLabels = useMemo(() => {
    if (!weeks || weeks.length === 0) return []
    const labels: { label: string; colIndex: number }[] = []
    let lastMonth = ''
    weeks.forEach((week, wi) => {
      const firstDay = week.contributionDays[0]
      if (!firstDay) return
      const month = new Date(firstDay.date).toLocaleString('en-US', { month: 'short' })
      if (month !== lastMonth) {
        labels.push({ label: month, colIndex: wi })
        lastMonth = month
      }
    })
    return labels
  }, [weeks])

  if (!weeks || weeks.length === 0) {
    return null
  }

  const totalContributions = weeks.reduce(
    (sum, week) =>
      sum + week.contributionDays.reduce((wSum, day) => wSum + day.contributionCount, 0),
    0
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Contributions</CardTitle>
          <span className="text-sm text-muted-foreground">
            {totalContributions} in the last 4 weeks
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={100}>
          {/* Month labels row */}
          <div className="flex gap-[3px] mb-1" style={{ paddingLeft: '24px' }}>
            {weeks.map((_week, wi) => {
              const label = monthLabels.find((m) => m.colIndex === wi)
              return (
                <div
                  key={wi}
                  className="text-[10px] text-muted-foreground"
                  style={{ width: '14px' }}
                >
                  {label?.label ?? ''}
                </div>
              )
            })}
          </div>

          <div className="flex gap-0">
            {/* Day-of-week labels */}
            <div className="flex flex-col gap-[3px] mr-1 shrink-0" style={{ width: '20px' }}>
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="text-[10px] text-muted-foreground leading-none flex items-center justify-end"
                  style={{ height: '14px' }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Grid — fixed-size cells like GitHub's contribution calendar */}
            <div className="flex gap-[3px] overflow-x-auto">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.contributionDays.map((day) => (
                    <Tooltip key={day.date}>
                      <TooltipTrigger asChild>
                        <div
                          className={`rounded-[2px] ${getColor(day.contributionCount)}`}
                          style={{ width: '14px', height: '14px' }}
                        />
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="text-xs"
                        style={{ borderRadius: '0px' }}
                      >
                        {day.contributionCount} contribution
                        {day.contributionCount !== 1 ? 's' : ''} on{' '}
                        {new Date(day.date).toLocaleDateString()}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </TooltipProvider>

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="h-3 w-3 rounded-[2px] bg-muted" />
            <div className="h-3 w-3 rounded-[2px] bg-green-200 dark:bg-green-900" />
            <div className="h-3 w-3 rounded-[2px] bg-green-400 dark:bg-green-700" />
            <div className="h-3 w-3 rounded-[2px] bg-green-600 dark:bg-green-500" />
            <div className="h-3 w-3 rounded-[2px] bg-green-800 dark:bg-green-400" />
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  )
}
