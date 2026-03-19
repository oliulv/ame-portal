'use client'

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

export function ContributionCalendar({ weeks }: ContributionCalendarProps) {
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Contributions</CardTitle>
          <span className="text-sm text-muted-foreground">
            {totalContributions} in the last 4 weeks
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={100}>
          <div className="flex gap-[3px] overflow-x-auto">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.contributionDays.map((day) => (
                  <Tooltip key={day.date}>
                    <TooltipTrigger asChild>
                      <div
                        className={`h-[13px] w-[13px] rounded-[2px] ${getColor(day.contributionCount)}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {day.contributionCount} contribution{day.contributionCount !== 1 ? 's' : ''}{' '}
                      on {new Date(day.date).toLocaleDateString()}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            ))}
          </div>
        </TooltipProvider>

        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-[3px]">
            <div className="h-[11px] w-[11px] rounded-[2px] bg-muted" />
            <div className="h-[11px] w-[11px] rounded-[2px] bg-green-200 dark:bg-green-900" />
            <div className="h-[11px] w-[11px] rounded-[2px] bg-green-400 dark:bg-green-700" />
            <div className="h-[11px] w-[11px] rounded-[2px] bg-green-600 dark:bg-green-500" />
            <div className="h-[11px] w-[11px] rounded-[2px] bg-green-800 dark:bg-green-400" />
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  )
}
