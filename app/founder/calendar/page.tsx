'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, ExternalLink, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'

export default function FounderCalendarPage() {
  const events = useQuery(api.cohortEvents.listForFounder)
  const registerEvent = useMutation(api.cohortEvents.register)
  const unregisterEvent = useMutation(api.cohortEvents.unregister)
  const [togglingId, setTogglingId] = useState<Id<'cohortEvents'> | null>(null)

  const isLoading = events === undefined

  async function handleRegister(eventId: Id<'cohortEvents'>) {
    setTogglingId(eventId)
    try {
      await registerEvent({ eventId })
      toast.success('Registered for event')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to register')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleUnregister(eventId: Id<'cohortEvents'>) {
    setTogglingId(eventId)
    try {
      await unregisterEvent({ eventId })
      toast.success('Unregistered from event')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to unregister')
    } finally {
      setTogglingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full " />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Events</h1>
        <p className="text-muted-foreground">Upcoming events for your cohort</p>
      </div>

      {events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event) => {
            const isToggling = togglingId === event._id

            return (
              <Card
                key={event._id}
                className={event.isRegistered ? 'border-green-200 bg-green-50/50' : ''}
              >
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{event.title}</p>
                      {event.isRegistered && (
                        <Badge variant="success" className="text-[10px] px-1.5 py-0">
                          <Check className="mr-0.5 h-2.5 w-2.5" />
                          Registered
                        </Badge>
                      )}
                    </div>
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
                  <div className="flex items-center gap-2 shrink-0">
                    {event.isRegistered ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={() => handleUnregister(event._id)}
                        disabled={isToggling}
                      >
                        Undo
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegister(event._id)}
                        disabled={isToggling}
                      >
                        {isToggling ? '...' : "I'm Registered"}
                      </Button>
                    )}
                    <a
                      href={event.lumaEmbedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-1.5  border bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                    >
                      {event.isRegistered ? 'View Event' : 'Register'}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
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
