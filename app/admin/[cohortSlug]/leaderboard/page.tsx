'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams, useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  Plus,
  ChevronDown,
  ChevronUp,
  Star,
  StarOff,
  Flame,
  AlertTriangle,
  AlertCircle,
  Info,
  Settings2,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { ScoringChatbot } from '@/components/leaderboard/scoring-chatbot'
import type { Id } from '@/convex/_generated/dataModel'

const CATEGORY_COLORS: Record<string, string> = {
  revenue: 'bg-emerald-500',
  traffic: 'bg-blue-500',
  github: 'bg-purple-500',
  social: 'bg-pink-500',
  updates: 'bg-orange-500',
  milestones: 'bg-yellow-500',
}

const CATEGORY_LABELS: Record<string, string> = {
  revenue: 'Revenue',
  traffic: 'Traffic',
  github: 'GitHub',
  social: 'Social',
  updates: 'Updates',
  milestones: 'Milestones',
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  revenue: 22,
  traffic: 18,
  github: 16,
  social: 16,
  updates: 15,
  milestones: 13,
}

function ScoreBar({ value, maxValue, color }: { value: number; maxValue: number; color: string }) {
  const width = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0
  return (
    <div className="h-2 w-full bg-muted overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-500`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

function ScoringExplainerContent() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div>
          <h3 className="font-semibold mb-3">Categories & Weights</h3>
          <div className="space-y-2">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <div className={`h-3 w-3 shrink-0 ${CATEGORY_COLORS[key]}`} />
                <span className="text-sm w-20 shrink-0">{label}</span>
                <div className="h-2 bg-muted overflow-hidden" style={{ width: '120px' }}>
                  <div
                    className={`h-full ${CATEGORY_COLORS[key]}`}
                    style={{ width: `${(CATEGORY_WEIGHTS[key] / 22) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground shrink-0">
                  {CATEGORY_WEIGHTS[key]}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium mb-1">Rolling 4-Week Window</h4>
            <p className="text-muted-foreground">Only the last 4 weeks count.</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Temporal Decay</h4>
            <p className="text-muted-foreground">This week 100%, last week ~81%, 2 weeks ~66%.</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">40% Cap</h4>
            <p className="text-muted-foreground">No single category can exceed 40%.</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">4-of-6 Gate</h4>
            <p className="text-muted-foreground">Need activity in 4+ categories to rank.</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Consistency Bonus</h4>
            <p className="text-muted-foreground">Steady performance earns up to +5%.</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Admin Favourite</h4>
            <p className="text-muted-foreground">Favourited updates get a 1.25x multiplier.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ExpandableRow({ entry, maxScore }: { entry: any; maxScore: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className={`cursor-pointer hover:bg-muted/50 transition-colors ${
          entry.excludeFromMetrics ? 'opacity-50' : ''
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
          {entry.rank ? (
            <span className="inline-flex h-7 w-7 items-center justify-center bg-primary text-primary-foreground text-xs font-bold">
              {entry.rank}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
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
            <span className="text-sm font-medium">{entry.startupName}</span>
            {entry.excludeFromMetrics && (
              <Badge variant="warning" className="text-xs">
                Excluded
              </Badge>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1 items-center">
            {Object.entries(entry.categories).map(([key, cat]: [string, any]) => (
              <div
                key={key}
                className="w-12"
                title={`${CATEGORY_LABELS[key]}: ${cat.weighted.toFixed(1)}`}
              >
                <ScoreBar
                  value={cat.weighted}
                  maxValue={maxScore * 0.4}
                  color={CATEGORY_COLORS[key]}
                />
              </div>
            ))}
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-right">
          {entry.totalScore.toFixed(1)}
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-center">
          {entry.isFavoriteThisWeek && (
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 inline" />
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-center text-sm">
          {entry.updateStreak > 0 && (
            <span className="inline-flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              {entry.updateStreak}
            </span>
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-center">
          {entry.anomalies.length > 0 && (
            <AlertTriangle className="h-4 w-4 text-amber-500 inline" />
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground inline ml-1" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground inline ml-1" />
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 py-4 bg-muted/30">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(entry.categories).map(([key, cat]: [string, any]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 ${CATEGORY_COLORS[key]}`} />
                    <span className="text-xs font-medium">{CATEGORY_LABELS[key]}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {CATEGORY_WEIGHTS[key]}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Raw: {cat.raw.toFixed(1)} | Norm: {cat.normalized.toFixed(1)} | Score:{' '}
                    {cat.weighted.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span>Active categories: {entry.activeCategories}/6</span>
              <span>Consistency bonus: +{entry.consistencyBonus.toFixed(1)}%</span>
              {entry.favoriteMultiplier > 1 && (
                <span className="text-yellow-600">Favorite boost: x{entry.favoriteMultiplier}</span>
              )}
              {entry.anomalies.length > 0 && (
                <span className="text-amber-600">{entry.anomalies.length} anomaly flag(s)</span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function LeaderboardPage() {
  const params = useParams()
  const router = useRouter()
  const cohortSlug = params.cohortSlug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const leaderboard = useQuery(
    api.leaderboard.computeLeaderboard,
    cohort ? { cohortId: cohort._id } : 'skip'
  )

  const [activeTab, setActiveTab] = useState<'rankings' | 'updates'>('rankings')
  const [showExplainer, setShowExplainer] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [pValue, setPValue] = useState(0.7)
  const updateP = useMutation(api.leaderboard.updateNormalizationPower)

  // Weekly updates data
  const currentWeek = useMemo(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return d.toISOString().slice(0, 10)
  }, [])
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)
  const updates = useQuery(
    api.weeklyUpdates.list,
    cohort && activeTab === 'updates' ? { cohortId: cohort._id, weekOf: selectedWeek } : 'skip'
  )
  const summary = useQuery(
    api.weeklyUpdates.getWeeklySummary,
    cohort && activeTab === 'updates' ? { cohortId: cohort._id, weekOf: selectedWeek } : 'skip'
  )
  const setFavorite = useMutation(api.weeklyUpdates.setFavorite)

  const handleToggleFavorite = async (updateId: Id<'weeklyUpdates'>, currentValue: boolean) => {
    try {
      await setFavorite({ updateId, isFavorite: !currentValue })
      toast.success(!currentValue ? 'Marked as favourite' : 'Removed from favourites')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update')
    }
  }

  const maxScore = useMemo(() => {
    if (!leaderboard?.ranked?.length) return 10
    return Math.max(...leaderboard.ranked.map((r: any) => r.totalScore), 1)
  }, [leaderboard])

  const isLoading = cohort === undefined || leaderboard === undefined

  if (cohort === null) {
    router.push('/admin/cohorts')
    return null
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const totalStartups = (leaderboard?.ranked?.length ?? 0) + (leaderboard?.unranked?.length ?? 0)

  if (totalStartups === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Leaderboard</h1>
          <p className="text-muted-foreground">
            Track startup progress and performance for {cohort?.label}
          </p>
        </div>
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No startups enrolled"
          description="Invite startups to start tracking their progress."
          action={
            <Link href={`/admin/${cohortSlug}/startups`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                View Startups
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Leaderboard</h1>
          <p className="text-muted-foreground">
            Track startup progress and performance for {cohort?.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowExplainer(!showExplainer)}>
            <Info className="mr-2 h-4 w-4" />
            How scoring works
            {showExplainer ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
            <Settings2 className="mr-2 h-4 w-4" />
            Config
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('rankings')}
            className={`px-4 py-3 border-b-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'rankings'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Rankings
          </button>
          <button
            onClick={() => setActiveTab('updates')}
            className={`px-4 py-3 border-b-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'updates'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Weekly Updates
            {summary && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {summary.submittedCount}/{summary.totalStartups}
              </Badge>
            )}
          </button>
        </nav>
      </div>

      {/* Rankings tab */}
      {activeTab === 'rankings' && (
        <>
          {/* Scoring explainer — rendered below header */}
          {showExplainer && <ScoringExplainerContent />}

          {/* Scoring config (super_admin) */}
          {showConfig && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Normalization Power (p)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    More compressed
                  </span>
                  <input
                    type="range"
                    min={0.3}
                    max={1.0}
                    step={0.05}
                    value={pValue}
                    onChange={(e) => setPValue(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    More linear
                  </span>
                  <span className="text-sm font-mono font-bold w-10 text-right">
                    {pValue.toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await updateP({ cohortId: cohort!._id, normalizationPower: pValue })
                        toast.success('Normalization power updated')
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Failed')
                      }
                    }}
                  >
                    Apply
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPValue(0.7)}>
                    Reset to default (0.70)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Current: {leaderboard?.normalizationPower?.toFixed(2) ?? '0.70'}. Changes
                  recalculate all scores retroactively.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Leaderboard table */}
          <div className="bg-card border overflow-hidden overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Startup
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Score Breakdown
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                    Score
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-10">
                    Fav
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">
                    Streak
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leaderboard?.ranked?.map((entry: any) => (
                  <ExpandableRow key={entry.startupId} entry={entry} maxScore={maxScore} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Unranked section */}
          {leaderboard?.unranked && leaderboard.unranked.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Unranked ({leaderboard.unranked.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                These startups don&apos;t meet the 4-of-6 category activity requirement.
              </p>
              <div className="bg-card border overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                  <tbody className="divide-y divide-border">
                    {leaderboard.unranked.map((entry: any) => (
                      <tr key={entry.startupId} className="opacity-60">
                        <td className="px-4 py-3 w-12">
                          <span className="text-muted-foreground text-sm">-</span>
                        </td>
                        <td className="px-4 py-3">
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
                            <span className="text-sm">{entry.startupName}</span>
                            <Badge variant="outline" className="text-xs">
                              {entry.activeCategories}/6 active
                            </Badge>
                            {entry.excludeFromMetrics && (
                              <Badge variant="warning" className="text-xs">
                                Excluded
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                          {entry.totalScore.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`h-2 w-2 ${CATEGORY_COLORS[key]}`} />
                {label} ({CATEGORY_WEIGHTS[key]}%)
              </div>
            ))}
          </div>
        </>
      )}

      {/* Weekly Updates tab */}
      {activeTab === 'updates' && (
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
      )}

      {/* AI Chatbot */}
      <ScoringChatbot />
    </div>
  )
}
