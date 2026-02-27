'use client'

import Script from 'next/script'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, ExternalLink } from 'lucide-react'

function extractLumaEventId(url: string): string | null {
  const match = url.match(/(evt-[a-zA-Z0-9]+)/)
  return match?.[1] ?? null
}

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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Script
        id="luma-checkout"
        src="https://embed.lu.ma/checkout-button.js"
        strategy="afterInteractive"
      />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Events</h1>
        <p className="text-muted-foreground">Upcoming events for your cohort</p>
      </div>

      {events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event) => {
            const eventId = extractLumaEventId(event.lumaEmbedUrl)
            return (
              <Card key={event._id}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.date).toLocaleDateString('en-GB', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                    )}
                  </div>
                  <a
                    href={event.lumaEmbedUrl}
                    className="luma-checkout--button inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    data-luma-action="checkout"
                    data-luma-event-id={eventId}
                  >
                    Register
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </CardContent>
              </Card>
            )
          })}
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
