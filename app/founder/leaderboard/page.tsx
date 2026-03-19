'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Star, Flame, Trophy } from 'lucide-react'
import Image from 'next/image'
import { ScoringChatbot } from '@/components/leaderboard/scoring-chatbot'

export default function FounderLeaderboardPage() {
  const leaderboard = useQuery(api.leaderboard.computeLeaderboardForFounder)

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Leaderboard</h1>
        <p className="text-muted-foreground">
          See how your startup ranks in {leaderboard.cohortName}
        </p>
      </div>

      {/* Your position card */}
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
                  : 'Need activity in at least 4 of 6 categories to be ranked'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
            {leaderboard.ranked.map((entry) => (
              <tr
                key={entry.startupId}
                className={entry.startupId === leaderboard.myStartupId ? 'bg-primary/5' : ''}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex h-7 w-7 items-center justify-center bg-primary text-primary-foreground text-xs font-bold">
                    {entry.rank}
                  </span>
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
                    {entry.isFavoriteThisWeek && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold">
                  {entry.totalScore.toFixed(1)}
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

      {/* Unranked */}
      {leaderboard.unranked.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <p>
            {leaderboard.unranked.length} startup(s) not yet ranked — need activity in 4+
            categories.
          </p>
        </div>
      )}

      <ScoringChatbot />
    </div>
  )
}
