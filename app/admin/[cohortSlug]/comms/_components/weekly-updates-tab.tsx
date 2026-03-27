'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Star, StarOff, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'

export function WeeklyUpdatesTab({ cohortId }: { cohortId: Id<'cohorts'> }) {
  const currentWeek = useMemo(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return d.toISOString().slice(0, 10)
  }, [])

  const [selectedWeek, setSelectedWeek] = useState(currentWeek)

  const updates = useQuery(api.weeklyUpdates.list, {
    cohortId,
    weekOf: selectedWeek,
  })
  const summary = useQuery(api.weeklyUpdates.getWeeklySummary, {
    cohortId,
    weekOf: selectedWeek,
  })
  const setFavorite = useMutation(api.weeklyUpdates.setFavorite)

  const handleToggleFavorite = async (updateId: Id<'weeklyUpdates'>, currentValue: boolean) => {
    try {
      await setFavorite({ updateId, isFavorite: !currentValue })
      toast.success(!currentValue ? 'Marked as favourite' : 'Removed from favourites')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update')
    }
  }

  return (
    <div className="space-y-4">
      {/* Week selector */}
      <div className="flex items-center gap-4">
        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={currentWeek}>{currentWeek}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
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
              <p className="text-sm text-muted-foreground">Favourites</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Updates */}
      {updates && updates.length > 0 ? (
        updates.map((update: any) => (
          <Card key={update._id} className={update.isFavorite ? 'ring-2 ring-yellow-400' : ''}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-semibold">{update.startupName}</span>
                    {update.primaryMetric && (
                      <Badge variant="outline" className="text-xs">
                        {update.primaryMetric.label}: {update.primaryMetric.value.toLocaleString()}
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
        ))
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center py-4">
              No updates submitted this week yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Missing startups */}
      {summary && summary.missing.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Missing ({summary.missingCount})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.missing.map((s: any) => (
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
