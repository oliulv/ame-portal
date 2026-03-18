'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Megaphone } from 'lucide-react'

export default function FounderAnnouncementsPage() {
  const announcements = useQuery(api.announcements.listForFounder)

  if (announcements === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Announcements</h1>
        <p className="text-muted-foreground">Updates from the programme</p>
      </div>

      {announcements.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-6 w-6" />}
          title="No announcements yet"
          description="Announcements from the programme team will appear here."
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a._id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{a.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {a.body}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(a.sentAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
