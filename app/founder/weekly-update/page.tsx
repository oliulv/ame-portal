'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Flame, Clock, Send, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

function getDeadline(): Date {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? 1 : 8 - day
  const deadline = new Date(now)
  deadline.setUTCDate(deadline.getUTCDate() + diff)
  deadline.setUTCHours(9, 0, 0, 0)
  return deadline
}

function formatCountdown(deadline: Date): string {
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  if (diff <= 0) return 'Deadline passed'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `${days}d ${hours}h remaining`
  if (hours > 0) return `${hours}h ${minutes}m remaining`
  return `${minutes}m remaining`
}

export default function WeeklyUpdatePage() {
  const currentUpdate = useQuery(api.weeklyUpdates.getCurrent)
  const streak = useQuery(api.weeklyUpdates.getCurrentStreak, {})
  const history = useQuery(api.weeklyUpdates.listForStartup, {})
  const submitUpdate = useMutation(api.weeklyUpdates.submit)

  const [highlight, setHighlight] = useState('')
  const [metricLabel, setMetricLabel] = useState('')
  const [metricValue, setMetricValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState('')
  const [editing, setEditing] = useState(false)

  const deadline = getDeadline()
  const isPastDeadline = new Date() > deadline
  const hasSubmitted = !!currentUpdate
  const isLocked = hasSubmitted && !editing

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(formatCountdown(deadline))
    }, 60000)
    setCountdown(formatCountdown(deadline))
    return () => clearInterval(timer)
  }, [deadline])

  // Populate form with existing update
  useEffect(() => {
    if (currentUpdate) {
      setHighlight(currentUpdate.highlight)
      if (currentUpdate.primaryMetric) {
        setMetricLabel(currentUpdate.primaryMetric.label)
        setMetricValue(String(currentUpdate.primaryMetric.value))
      }
    }
  }, [currentUpdate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!highlight.trim()) {
      toast.error('Write a quick update about your week')
      return
    }

    setSubmitting(true)
    try {
      await submitUpdate({
        highlight: highlight.trim(),
        primaryMetric:
          metricLabel && metricValue
            ? { label: metricLabel, value: Number(metricValue) }
            : undefined,
      })
      toast.success(currentUpdate ? 'Update saved' : 'Weekly update submitted!')
      setEditing(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  if (currentUpdate === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Weekly Update</h1>
          <p className="text-muted-foreground">What happened this week?</p>
        </div>
        <div className="flex items-center gap-3">
          {(streak ?? 0) > 0 && (
            <Badge variant="secondary" className="text-sm">
              <Flame className="mr-1 h-4 w-4 text-orange-500" />
              {streak} week streak
            </Badge>
          )}
          <Badge variant={isPastDeadline ? 'destructive' : 'outline'} className="text-sm">
            <Clock className="mr-1 h-4 w-4" />
            {countdown}
          </Badge>
        </div>
      </div>

      {/* Submitted read-only state */}
      {hasSubmitted && !editing && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    Submitted
                  </span>
                </div>
                <p className="text-sm">{currentUpdate.highlight}</p>
                {currentUpdate.primaryMetric && (
                  <Badge variant="outline" className="text-xs">
                    {currentUpdate.primaryMetric.label}:{' '}
                    {currentUpdate.primaryMetric.value.toLocaleString()}
                  </Badge>
                )}
              </div>
              {!isPastDeadline && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form: shown when not yet submitted, or when editing */}
      {(!hasSubmitted || editing) && (
        <Card>
          <CardHeader>
            <CardTitle>This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="highlight">
                  What did you ship, learn, or discover this week? *
                </Label>
                <Textarea
                  id="highlight"
                  placeholder="We landed our first paying customer, shipped v2 of the onboarding flow, and discovered our CAC is 3x lower via LinkedIn than Google..."
                  value={highlight}
                  onChange={(e) => setHighlight(e.target.value)}
                  disabled={isPastDeadline}
                  className="min-h-[100px]"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">{highlight.length}/500</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metricLabel" className="text-muted-foreground">
                    Key metric (optional)
                  </Label>
                  <Input
                    id="metricLabel"
                    placeholder="e.g. MRR, Users"
                    value={metricLabel}
                    onChange={(e) => setMetricLabel(e.target.value)}
                    disabled={isPastDeadline}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metricValue" className="text-muted-foreground">
                    Value
                  </Label>
                  <Input
                    id="metricValue"
                    type="number"
                    placeholder="e.g. 5000"
                    value={metricValue}
                    onChange={(e) => setMetricValue(e.target.value)}
                    disabled={isPastDeadline}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting || isPastDeadline}>
                  <Send className="mr-2 h-4 w-4" />
                  {submitting ? 'Saving...' : hasSubmitted ? 'Save Changes' : 'Submit'}
                </Button>
                {editing && (
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Previous updates */}
      {history && history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Previous Updates</h2>
          {history.map((update) => (
            <Card key={update._id} className="opacity-80">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Week of {update.weekOf}</p>
                    <p className="text-sm">{update.highlight}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {update.isFavorite && (
                      <Badge variant="secondary" className="text-xs">
                        Favourite
                      </Badge>
                    )}
                    {update.primaryMetric && (
                      <Badge variant="outline" className="text-xs">
                        {update.primaryMetric.label}: {update.primaryMetric.value.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
