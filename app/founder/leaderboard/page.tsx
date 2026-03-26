'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Star, Flame, Trophy, Send, CheckCircle, Pencil, Info, ChevronDown } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { MomentumArrow } from '@/components/leaderboard/momentum-arrow'
import { ScoringExplainerContent } from '@/components/leaderboard/scoring-explainer'

function WeeklyUpdateModal() {
  const currentUpdate = useQuery(api.weeklyUpdates.getCurrent)
  const streak = useQuery(api.weeklyUpdates.getCurrentStreak, {})
  const submitUpdate = useMutation(api.weeklyUpdates.submit)

  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState('')
  const [metricLabel, setMetricLabel] = useState('')
  const [metricValue, setMetricValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (currentUpdate) {
      setHighlight(currentUpdate.highlight)
      if (currentUpdate.primaryMetric) {
        setMetricLabel(currentUpdate.primaryMetric.label)
        setMetricValue(String(currentUpdate.primaryMetric.value))
      }
    }
  }, [currentUpdate])

  const handleSubmit = async () => {
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
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Submitted state */}
      {currentUpdate && !open && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    Weekly update submitted
                  </span>
                  {(streak ?? 0) > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <Flame className="mr-1 h-3 w-3 text-orange-500" />
                      {streak}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{currentUpdate.highlight}</p>
              </div>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                </DialogTrigger>
                <WeeklyUpdateDialogContent
                  highlight={highlight}
                  setHighlight={setHighlight}
                  metricLabel={metricLabel}
                  setMetricLabel={setMetricLabel}
                  metricValue={metricValue}
                  setMetricValue={setMetricValue}
                  submitting={submitting}
                  onSubmit={handleSubmit}
                  isEdit
                />
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not submitted */}
      {!currentUpdate && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Card className="border-dashed cursor-pointer hover:bg-muted/30 transition-colors">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Submit your weekly update</p>
                    <p className="text-xs text-muted-foreground">
                      What did you ship, learn, or discover?
                    </p>
                  </div>
                  <Button size="sm">
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Update
                  </Button>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <WeeklyUpdateDialogContent
            highlight={highlight}
            setHighlight={setHighlight}
            metricLabel={metricLabel}
            setMetricLabel={setMetricLabel}
            metricValue={metricValue}
            setMetricValue={setMetricValue}
            submitting={submitting}
            onSubmit={handleSubmit}
            isEdit={false}
          />
        </Dialog>
      )}
    </>
  )
}

function WeeklyUpdateDialogContent({
  highlight,
  setHighlight,
  metricLabel,
  setMetricLabel,
  metricValue,
  setMetricValue,
  submitting,
  onSubmit,
  isEdit,
}: {
  highlight: string
  setHighlight: (v: string) => void
  metricLabel: string
  setMetricLabel: (v: string) => void
  metricValue: string
  setMetricValue: (v: string) => void
  submitting: boolean
  onSubmit: () => void
  isEdit: boolean
}) {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Weekly Update' : 'Weekly Update'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="highlight">What did you ship, learn, or discover this week?</Label>
          <Textarea
            id="highlight"
            placeholder="We landed our first paying customer, shipped v2 of the onboarding flow..."
            value={highlight}
            onChange={(e) => setHighlight(e.target.value)}
            className="min-h-[100px]"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">{highlight.length}/500</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="metricLabel" className="text-muted-foreground text-xs">
              Key metric (optional)
            </Label>
            <Input
              id="metricLabel"
              placeholder="e.g. MRR"
              value={metricLabel}
              onChange={(e) => setMetricLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="metricValue" className="text-muted-foreground text-xs">
              Value
            </Label>
            <Input
              id="metricValue"
              type="number"
              placeholder="e.g. 5000"
              value={metricValue}
              onChange={(e) => setMetricValue(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={onSubmit} disabled={submitting} className="w-full">
          <Send className="mr-2 h-4 w-4" />
          {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Submit'}
        </Button>
      </div>
    </DialogContent>
  )
}

export default function FounderLeaderboardPage() {
  const leaderboard = useQuery(api.leaderboard.computeLeaderboardForFounder)
  const [showExplainer, setShowExplainer] = useState(false)

  if (leaderboard === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!leaderboard) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight font-display">Leaderboard</h1>
        <p className="text-muted-foreground">Leaderboard not available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Leaderboard</h1>
          <p className="text-muted-foreground">
            See how your startup ranks in {leaderboard.cohortName}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExplainer(!showExplainer)}
          className="shrink-0"
        >
          <Info className="mr-1.5 h-3.5 w-3.5" />
          How scoring works
          <ChevronDown
            className={`ml-1.5 h-3.5 w-3.5 transition-transform ${showExplainer ? 'rotate-180' : ''}`}
          />
        </Button>
      </div>

      {showExplainer && <ScoringExplainerContent />}

      {/* Your position + weekly update */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center bg-primary text-primary-foreground">
                {leaderboard.myRank ? (
                  <span className="text-xl font-bold">#{leaderboard.myRank}</span>
                ) : (
                  <Trophy className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {leaderboard.myRank ? `You're ranked #${leaderboard.myRank}` : 'Not yet ranked'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {leaderboard.myRank
                    ? `Score: ${leaderboard.myScore.toFixed(1)} points`
                    : 'Need activity in at least 3 of 5 categories to be ranked'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <WeeklyUpdateModal />
      </div>

      {/* Leaderboard table */}
      <div className="bg-card border overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Startup
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                Score
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">
                Streak
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              ...leaderboard.ranked,
              ...leaderboard.unranked.sort((a, b) => b.totalScore - a.totalScore),
            ].map((entry) => (
              <tr
                key={entry.startupId}
                className={`${entry.startupId === leaderboard.myStartupId ? 'bg-primary/5' : ''} ${entry.excludeFromMetrics ? 'opacity-50' : !entry.qualified ? 'opacity-60' : ''}`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  {entry.rank ? (
                    <span className="inline-flex h-7 w-7 items-center justify-center bg-primary text-primary-foreground text-xs font-bold">
                      {entry.rank}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    {entry.startupLogoUrl && (
                      <Image
                        src={entry.startupLogoUrl}
                        alt={entry.startupName}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full"
                      />
                    )}
                    <span className="text-sm font-medium">
                      {entry.startupName}
                      {entry.startupId === leaderboard.myStartupId && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          You
                        </Badge>
                      )}
                    </span>
                    {entry.excludeFromMetrics && (
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground"
                        title="This startup is excluded from ranking metrics"
                      >
                        Excluded
                      </Badge>
                    )}
                    {entry.qualified && !entry.excludeFromMetrics && (
                      <Badge
                        variant="default"
                        className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      >
                        Qualified
                      </Badge>
                    )}
                    {entry.isFavoriteThisWeek && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold">
                  <span className="inline-flex items-center gap-1.5">
                    {entry.totalScore.toFixed(1)}
                    <MomentumArrow momentum={entry.momentum} />
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-sm">
                  {entry.updateStreak > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5 text-orange-500" />
                      {entry.updateStreak}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
