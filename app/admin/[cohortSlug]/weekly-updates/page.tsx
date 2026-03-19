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

function getRecentWeeks(count: number): string[] {
  const weeks: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    weeks.push(getMonday(d))
  }
  return weeks
}

export default function AdminWeeklyUpdatesPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })

  const weeks = useMemo(() => getRecentWeeks(12), [])
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
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="border bg-background px-3 py-2 text-sm"
        >
          {weeks.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
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
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{update.startupName}</CardTitle>
                    <Badge variant="outline">
                      {update.primaryMetric.label}: {update.primaryMetric.value.toLocaleString()}
                    </Badge>
                    {update.usersTalkedTo > 0 && (
                      <Badge variant="secondary">{update.usersTalkedTo} users talked to</Badge>
                    )}
                  </div>
                  <Button
                    variant={update.isFavorite ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleFavorite(update._id, update.isFavorite)}
                  >
                    {update.isFavorite ? (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <StarOff className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-foreground mb-1">Key Learnings</p>
                  <p className="text-muted-foreground">{update.learnings}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Goals for Next Week</p>
                  <p className="text-muted-foreground">{update.goalsNextWeek}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Biggest Obstacle</p>
                  <p className="text-muted-foreground">{update.biggestObstacle}</p>
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
