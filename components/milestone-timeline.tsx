'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, ExternalLink, FileText, RotateCw, Send, Undo2 } from 'lucide-react'

const ACTION_CONFIG = {
  submitted: {
    label: 'Submitted',
    icon: Send,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    badgeVariant: 'info' as const,
  },
  changes_requested: {
    label: 'Changes Requested',
    icon: RotateCw,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    badgeVariant: 'warning' as const,
  },
  approved: {
    label: 'Approved',
    icon: Check,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    badgeVariant: 'success' as const,
  },
  withdrawn: {
    label: 'Withdrawn',
    icon: Undo2,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-500',
    badgeVariant: 'secondary' as const,
  },
}

interface MilestoneTimelineProps {
  milestoneId: Id<'milestones'>
}

export function MilestoneTimeline({ milestoneId }: MilestoneTimelineProps) {
  const events = useQuery(api.milestones.listEvents, { milestoneId })

  if (events === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No activity yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-4">
            {events.map((event) => {
              const config = ACTION_CONFIG[event.action]
              const Icon = config.icon

              return (
                <div key={event._id} className="relative flex gap-3">
                  {/* Icon */}
                  <div
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.iconBg}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${config.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={config.badgeVariant} className="text-[10px] px-1.5 py-0">
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        by {event.userName}
                        {event.userRole === 'super_admin' || event.userRole === 'admin'
                          ? ' (admin)'
                          : ''}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event._creationTime).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        {new Date(event._creationTime).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Comment */}
                    {event.comment && (
                      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                        {event.comment}
                      </p>
                    )}

                    {/* Evidence snapshot */}
                    {(event.planLink || event.planStorageId) && (
                      <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                        {event.planLink && (
                          <a
                            href={event.planLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Link
                          </a>
                        )}
                        {event.planStorageId && event.fileUrl && (
                          <a
                            href={event.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <FileText className="h-3 w-3" />
                            {event.planFileName || 'File'}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
