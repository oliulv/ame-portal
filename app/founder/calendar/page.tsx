'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar } from 'lucide-react'

export default function FounderCalendarPage() {
  const events = useQuery(api.cohortEvents.listForFounder)

  const isLoading = events === undefined

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="py-8">
                <Skeleton className="h-60 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground">Upcoming events for your cohort</p>
      </div>

      {events.length > 0 ? (
        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event._id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{event.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(event.date).toLocaleDateString('en-GB', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {event.description && (
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                )}
                <iframe
                  src={event.lumaEmbedUrl}
                  className="w-full rounded-lg border"
                  style={{ height: 450 }}
                  allowFullScreen
                  aria-hidden="false"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="No upcoming events"
          description="There are no events scheduled for your cohort yet."
        />
      )}
    </div>
  )
}
