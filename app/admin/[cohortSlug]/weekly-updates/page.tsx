'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams } from 'next/navigation'
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Star, StarOff, Users, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'

function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

// Weekly updates launched 2026-03-16 — only show weeks from then onwards
const WEEKLY_UPDATES_START = '2026-03-16'

function getAvailableWeeks(): string[] {
  const weeks: string[] = []
  const now = new Date()
  const current = getMonday(now)
  // Walk backwards from current week, stop at launch week
  const d = new Date(current + 'T00:00:00Z')
  const start = new Date(WEEKLY_UPDATES_START + 'T00:00:00Z')
  while (d >= start) {
    weeks.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() - 7)
  }
  return weeks
}

export default function AdminWeeklyUpdatesPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })

  const weeks = useMemo(() => getAvailableWeeks(), [])
  const [selectedWeek, setSelectedWeek] = useState(weeks[0])

  const updates = useQuery(
    api.weeklyUpdates.list,
    cohort ? { cohortId: cohort._id, weekOf: selectedWeek } : 'skip'
  )
  const summary = useQuery(
    api.weeklyUpdates.getWeeklySummary,
    cohort ? { cohortId: cohort._id, weekOf: selectedWeek } : 'skip'
  )
  const setFavorite = useMutation(api.weeklyUpdates.setFavorite)

  const isLoading = cohort === undefined || updates === undefined

  const handleToggleFavorite = async (updateId: Id<'weeklyUpdates'>, currentValue: boolean) => {
    try {
      await setFavorite({ updateId, isFavorite: !currentValue })
      toast.success(!currentValue ? 'Marked as favorite' : 'Removed from favorites')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Weekly Updates</h1>
          <p className="text-muted-foreground">Review startup progress for {cohort?.label}</p>
        </div>
      </div>

      {/* Week selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Week of:</label>
        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {weeks.map((w) => (
              <SelectItem key={w} value={w}>
                {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {summary.submittedCount}/{summary.totalStartups}
              </div>
              <p className="text-sm text-muted-foreground">Submitted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.missingCount}</div>
              <p className="text-sm text-muted-foreground">Missing</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.favoriteCount}/2</div>
              <p className="text-sm text-muted-foreground">Favorites picked</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Updates */}
      {!updates || updates.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No updates this week"
          description="No startups have submitted their weekly update yet."
        />
      ) : (
        <div className="space-y-4">
          {updates.map((update) => (
            <Card key={update._id} className={update.isFavorite ? 'ring-2 ring-yellow-400' : ''}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-semibold">{update.startupName}</span>
                      {update.primaryMetric && (
                        <Badge variant="outline" className="text-xs">
                          {update.primaryMetric.label}:{' '}
                          {update.primaryMetric.value.toLocaleString()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{update.highlight}</p>
                  </div>
                  <Button
                    variant={update.isFavorite ? 'default' : 'outline'}
                    size="sm"
                    className="shrink-0"
                    onClick={() => handleToggleFavorite(update._id, update.isFavorite)}
                  >
                    {update.isFavorite ? (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <StarOff className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Missing startups */}
      {summary && summary.missing.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Missing Updates ({summary.missingCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.missing.map((s) => (
                <Badge key={s._id} variant="outline" className="text-muted-foreground">
                  {s.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
