'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Target,
  FileText,
  Building2,
  Plug,
  Clock,
  Send,
  Check,
  Calendar,
  ExternalLink,
  Eye,
  CheckCircle,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'

export default function FounderDashboard() {
  const startup = useQuery(api.founderStartup.get)
  const milestones = useQuery(api.milestones.listForFounder)
  const fundingSummary = useQuery(api.milestones.fundingSummaryForFounder)
  const invoicesData = useQuery(api.invoices.listForFounder)
  const nextEvent = useQuery(api.cohortEvents.nextForFounder)
  const integrationStatus = useQuery(api.integrations.status)
  const trackerWebsites = useQuery(api.trackerWebsites.list)
  const registerEvent = useMutation(api.cohortEvents.register)
  const [isRegistering, setIsRegistering] = useState(false)

  const handleRegister = useCallback(
    async (eventId: Id<'cohortEvents'>) => {
      setIsRegistering(true)
      try {
        await registerEvent({ eventId })
        toast.success('Registered for event')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to register')
      } finally {
        setIsRegistering(false)
      }
    },
    [registerEvent]
  )

  const isLoading =
    startup === undefined ||
    milestones === undefined ||
    fundingSummary === undefined ||
    invoicesData === undefined

  const hasStripe = integrationStatus?.stripe?.status === 'active'
  const hasTracker = (trackerWebsites?.length ?? 0) > 0
  const trackerHasEvents = trackerWebsites?.some((w) => w.lastEventAt) ?? false
  const hasAnyIntegration = hasStripe || hasTracker
  const integrationsLoaded = integrationStatus !== undefined && trackerWebsites !== undefined

  const hasStartup = startup !== null

  const unlocked = fundingSummary?.unlocked ?? 0
  const deployed = fundingSummary?.deployed ?? 0
  const committed = fundingSummary?.committed ?? 0
  const available = fundingSummary?.available ?? 0
  const baseline = fundingSummary?.baseline ?? 0
  const cappedDeployed = Math.max(0, Math.min(deployed, unlocked))
  const unlockedPct = baseline > 0 ? (unlocked / baseline) * 100 : 0
  const deployedPct = unlocked > 0 ? (cappedDeployed / unlocked) * 100 : 0
  const committedPct =
    unlocked > 0 ? (Math.min(committed, unlocked - cappedDeployed) / unlocked) * 100 : 0
  const unlockedPctRounded = Math.round(unlockedPct)
  const pendingInvoices = invoicesData?.pendingCount ?? 0

  const upcomingMilestones = (milestones ?? [])
    .filter((m) => m.status === 'waiting' || m.status === 'submitted')
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return a.sortOrder - b.sortOrder
    })
    .slice(0, 3)

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-4" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!hasStartup) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your founder portal</p>
        </div>
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No startup found"
          description="No startup is associated with your account. Please contact support for assistance."
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your startup progress</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funding</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Deployed £{deployed.toLocaleString('en-GB')} of £{unlocked.toLocaleString('en-GB')}{' '}
                unlocked
              </p>
              {baseline > 0 && (
                <span className="text-xs text-muted-foreground">
                  {unlockedPctRounded}% of baseline unlocked
                </span>
              )}
            </div>
            <div
              className={`relative h-2.5 overflow-hidden rounded-full ${unlocked > 0 ? 'bg-emerald-500/25' : 'bg-muted'}`}
            >
              {unlocked > 0 && (
                <>
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-600 transition-all"
                    style={{ width: `${deployedPct}%` }}
                  />
                  {committed > 0 && (
                    <div
                      className="absolute inset-y-0 bg-violet-500 transition-all"
                      style={{ left: `${deployedPct}%`, width: `${committedPct}%` }}
                    />
                  )}
                </>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className=" border bg-muted/40 px-2 py-1.5">
                <p className="text-muted-foreground">Unlocked</p>
                <p className="font-medium">£{unlocked.toLocaleString('en-GB')}</p>
              </div>
              <div className=" border bg-muted/40 px-2 py-1.5">
                <p className="text-muted-foreground">Deployed</p>
                <p className="font-medium text-blue-600">£{deployed.toLocaleString('en-GB')}</p>
              </div>
              <div className=" border bg-muted/40 px-2 py-1.5">
                <p className="text-muted-foreground">Available</p>
                <p className="font-medium text-green-600">£{available.toLocaleString('en-GB')}</p>
              </div>
            </div>
            <Link href="/founder/funding" className="mt-auto pt-3 inline-block">
              <Button variant="link" size="sm" className="h-auto p-0">
                View funding details →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="text-2xl font-bold font-display">{pendingInvoices}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {pendingInvoices === 0 ? 'All caught up!' : `${pendingInvoices} awaiting review`}
            </p>
            <Link href="/founder/invoices" className="mt-auto pt-3 inline-block">
              <Button variant="link" size="sm" className="h-auto p-0">
                View invoices →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Milestones + Next Event */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Milestones</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {upcomingMilestones.length > 0 ? (
              <>
                <div className="flex-1 space-y-2">
                  {upcomingMilestones.map((m) => (
                    <Link
                      key={m._id}
                      href={`/founder/milestones/${m._id}`}
                      className="flex items-center gap-3 border px-3 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex-shrink-0">
                        {m.status === 'submitted' ? (
                          <Clock className="h-4 w-4 text-amber-600" />
                        ) : (
                          <Send className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{m.title}</p>
                          {m.status === 'submitted' && (
                            <Badge variant="warning" className="shrink-0 text-[10px] px-1.5 py-0">
                              Pending Review
                            </Badge>
                          )}
                          {m.status === 'waiting' && (
                            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                              Waiting
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {m.dueDate && (
                            <>
                              Due{' '}
                              {new Date(m.dueDate).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                              })}
                              {' · '}
                            </>
                          )}
                          {'\u00A3'}
                          {m.amount.toLocaleString('en-GB')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.status === 'waiting' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                            <span>Submit</span>
                          </Button>
                        )}
                        {m.status === 'submitted' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                            <span>View</span>
                          </Button>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
                <Link href="/founder/funding" className="mt-auto pt-3 inline-block">
                  <Button variant="link" size="sm" className="h-auto p-0">
                    View all →
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3  border border-green-200 bg-green-50/50 px-3 py-2.5">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">All caught up</p>
                      <p className="text-xs text-muted-foreground">
                        No milestones need action right now.
                      </p>
                    </div>
                    <span className="text-[10px] font-medium text-green-600">On track</span>
                  </div>
                </div>
                <Link href="/founder/funding" className="mt-auto pt-3 inline-block">
                  <Button variant="link" size="sm" className="h-auto p-0">
                    View funding details →
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Event</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {nextEvent ? (
              <>
                <div className="flex-1 space-y-2">
                  <div
                    className={`flex items-center gap-3  border px-3 py-2.5 ${nextEvent.isRegistered ? 'border-green-200 bg-green-50/50' : ''}`}
                  >
                    <div className="flex-shrink-0">
                      {nextEvent.isRegistered ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{nextEvent.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(nextEvent.date).toLocaleDateString('en-GB', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {nextEvent.isRegistered ? (
                        <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5">
                          <Check className="h-2.5 w-2.5" />
                          Going
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-1.5"
                          onClick={() => handleRegister(nextEvent._id)}
                          disabled={isRegistering}
                        >
                          {isRegistering ? '...' : "I'm Registered"}
                        </Button>
                      )}
                      <a
                        href={nextEvent.lumaEmbedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-7 shrink-0 items-center gap-1  border bg-secondary px-2.5 text-[11px] font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                      >
                        {nextEvent.isRegistered ? 'View Event' : 'Register'}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
                <Link href="/founder/calendar" className="mt-auto pt-3 inline-block">
                  <Button variant="link" size="sm" className="h-auto p-0">
                    View calendar →
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <p className="flex-1 text-sm text-muted-foreground">No upcoming events</p>
                <Link href="/founder/calendar" className="mt-auto pt-3 inline-block">
                  <Button variant="link" size="sm" className="h-auto p-0">
                    View calendar →
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Integration setup / waiting prompt */}
      {integrationsLoaded && !hasAnyIntegration && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-muted p-3">
                <Plug className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Set up integrations</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect Stripe to track revenue automatically, or add the Accelerate ME Tracker to
                  monitor website traffic. Your analytics dashboard will populate once connected.
                </p>
                <div className="mt-3 flex gap-2">
                  <Link href="/founder/integrations">
                    <Button size="sm">Connect Integrations</Button>
                  </Link>
                  <Link href="/founder/analytics">
                    <Button variant="outline" size="sm">
                      View Analytics
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {integrationsLoaded && hasTracker && !trackerHasEvents && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-amber-100 p-3">
                <Eye className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Waiting for tracker events</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your tracker is set up but hasn&apos;t received any events yet. Make sure
                  you&apos;ve added the tracking script to your website and published the changes.
                </p>
                <div className="mt-3 flex gap-2">
                  <Link href="/founder/integrations?tab=tracker">
                    <Button variant="outline" size="sm">
                      View Tracker Setup
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
