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
  const diff = day === 0 ? 1 : 8 - day // Days until next Monday
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

  const [metricLabel, setMetricLabel] = useState('')
  const [metricValue, setMetricValue] = useState('')
  const [usersTalkedTo, setUsersTalkedTo] = useState('')
  const [learnings, setLearnings] = useState('')
  const [goalsNextWeek, setGoalsNextWeek] = useState('')
  const [biggestObstacle, setBiggestObstacle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState('')

  const deadline = getDeadline()
  const isPastDeadline = new Date() > deadline

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
      setMetricLabel(currentUpdate.primaryMetric.label)
      setMetricValue(String(currentUpdate.primaryMetric.value))
      setUsersTalkedTo(String(currentUpdate.usersTalkedTo))
      setLearnings(currentUpdate.learnings)
      setGoalsNextWeek(currentUpdate.goalsNextWeek)
      setBiggestObstacle(currentUpdate.biggestObstacle)
    }
  }, [currentUpdate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!metricLabel || !metricValue || !learnings || !goalsNextWeek || !biggestObstacle) {
      toast.error('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      await submitUpdate({
        primaryMetric: { label: metricLabel, value: Number(metricValue) },
        usersTalkedTo: Number(usersTalkedTo) || 0,
        learnings,
        goalsNextWeek,
        biggestObstacle,
      })
      toast.success(currentUpdate ? 'Update saved' : 'Weekly update submitted!')
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
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Weekly Update</h1>
          <p className="text-muted-foreground">Share your progress with the cohort</p>
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

      {currentUpdate && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-400">
            Update submitted. You can edit until the deadline.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>This Week&apos;s Update</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="metricLabel">Primary Metric Label *</Label>
                <Input
                  id="metricLabel"
                  placeholder="e.g. MRR, Users, Revenue"
                  value={metricLabel}
                  onChange={(e) => setMetricLabel(e.target.value)}
                  disabled={isPastDeadline}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metricValue">Metric Value *</Label>
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

            <div className="space-y-2">
              <Label htmlFor="usersTalkedTo">Users / Customers Talked To</Label>
              <Input
                id="usersTalkedTo"
                type="number"
                placeholder="0"
                value={usersTalkedTo}
                onChange={(e) => setUsersTalkedTo(e.target.value)}
                disabled={isPastDeadline}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="learnings">Key Learnings *</Label>
              <Textarea
                id="learnings"
                placeholder="What did you learn this week?"
                value={learnings}
                onChange={(e) => setLearnings(e.target.value)}
                disabled={isPastDeadline}
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goalsNextWeek">Goals for Next Week *</Label>
              <Textarea
                id="goalsNextWeek"
                placeholder="What are your top priorities?"
                value={goalsNextWeek}
                onChange={(e) => setGoalsNextWeek(e.target.value)}
                disabled={isPastDeadline}
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="biggestObstacle">Biggest Obstacle *</Label>
              <Textarea
                id="biggestObstacle"
                placeholder="What's blocking your progress?"
                value={biggestObstacle}
                onChange={(e) => setBiggestObstacle(e.target.value)}
                disabled={isPastDeadline}
                className="min-h-[80px]"
              />
            </div>

            <Button type="submit" disabled={submitting || isPastDeadline}>
              <Send className="mr-2 h-4 w-4" />
              {submitting ? 'Submitting...' : currentUpdate ? 'Update' : 'Submit'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Previous updates */}
      {history && history.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Previous Updates</h2>
          {history.map((update) => (
            <Card key={update._id} className="opacity-80">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Week of {update.weekOf}</CardTitle>
                  <div className="flex items-center gap-2">
                    {update.isFavorite && (
                      <Badge variant="secondary" className="text-xs">
                        Admin Favorite
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {update.primaryMetric.label}: {update.primaryMetric.value.toLocaleString()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Learnings:</strong> {update.learnings}
                </p>
                <p>
                  <strong className="text-foreground">Goals:</strong> {update.goalsNextWeek}
                </p>
                <p>
                  <strong className="text-foreground">Obstacle:</strong> {update.biggestObstacle}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
