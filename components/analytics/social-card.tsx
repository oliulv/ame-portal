'use client'

import { Card, CardContent } from '@/components/ui/card'
import { GrowthIndicator } from './growth-indicator'

interface SocialCardProps {
  platform: 'twitter' | 'linkedin' | 'instagram'
  handle: string
  followers: number
  followerGrowth?: number
  engagementRate?: number
  engagementTrend?: number
}

const platformConfig = {
  twitter: { label: 'X (Twitter)', color: 'text-foreground' },
  linkedin: { label: 'LinkedIn', color: 'text-blue-600' },
  instagram: { label: 'Instagram', color: 'text-pink-600' },
}

export function SocialCard({
  platform,
  handle,
  followers,
  followerGrowth,
  engagementRate,
  engagementTrend,
}: SocialCardProps) {
  const config = platformConfig[platform]

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
            <p className="text-xs text-muted-foreground">@{handle}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-lg font-bold">{followers.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
            {followerGrowth !== undefined && (
              <GrowthIndicator change={followerGrowth} label="WoW" />
            )}
          </div>

          {engagementRate !== undefined && (
            <div>
              <p className="text-lg font-bold">{engagementRate.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground">Engagement</p>
              {engagementTrend !== undefined && (
                <GrowthIndicator change={engagementTrend} label="WoW" />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
