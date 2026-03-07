'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Building2, FileText, ArrowRight, Plus, Target, Inbox, Calendar } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

export default function AdminDashboard() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const stats = useQuery(api.startups.dashboardStats, { cohortSlug })
  const currentUser = useQuery(api.users.current)

  const isSuperAdmin = currentUser?.role === 'super_admin'

  // Permission checks for delegated admins
  const canApproveInvoices = useQuery(
    api.adminPermissions.checkMyPermission,
    cohort && currentUser
      ? { cohortId: cohort._id, permission: 'approve_invoices' as const }
      : 'skip'
  )

  // Milestones inbox — both roles
  const submittedMilestones = useQuery(
    api.milestones.listSubmittedByCohort,
    cohort ? { cohortId: cohort._id } : 'skip'
  )

  // Invoice inbox — super_admin or delegated approve_invoices
  const showInvoices = isSuperAdmin || canApproveInvoices === true
  const recentInvoices = useQuery(api.invoices.listForAdmin, showInvoices ? {} : 'skip')
  const upcomingEvents = useQuery(
    api.cohortEvents.list,
    isSuperAdmin && cohort ? { cohortId: cohort._id } : 'skip'
  )

  const isLoading = cohort === undefined || stats === undefined || currentUser === undefined

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const startupsCount = stats?.startupsCount || 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Dashboard</h1>
        <p className="text-muted-foreground">
          {cohort ? `Overview for ${cohort.label}` : 'Overview of your accelerator program'}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Startups</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="text-2xl font-bold font-display">{startupsCount}</div>
            <p className="text-xs text-muted-foreground">Startups in this cohort</p>
            <Link href={`/admin/${cohortSlug}/startups`} className="mt-auto pt-3 inline-block">
              <Button variant="link" size="sm" className="h-auto p-0">
                View startups →
              </Button>
            </Link>
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <div className="text-2xl font-bold font-display">{stats?.invoicesCount || 0}</div>
              <p className="text-xs text-muted-foreground">Invoices from this cohort</p>
              <Link href={`/admin/${cohortSlug}/invoices`} className="mt-auto pt-3 inline-block">
                <Button variant="link" size="sm" className="h-auto p-0">
                  View invoices →
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {isSuperAdmin && (
          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cohorts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <div className="text-2xl font-bold font-display">{stats?.cohortsCount || 0}</div>
              <p className="text-xs text-muted-foreground">All cohorts in system</p>
              <Link href="/admin/cohorts" className="mt-auto pt-3 inline-block">
                <Button variant="link" size="sm" className="h-auto p-0">
                  View cohorts →
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Empty state */}
      {startupsCount === 0 &&
        (isSuperAdmin ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="No startups enrolled"
            description="Get started by creating your first startup in this cohort. Once enrolled, you'll be able to track their progress, goals, and invoices."
            action={
              <Link href={`/admin/${cohortSlug}/startups/new`}>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Startup
                </Button>
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="No startups enrolled"
            description="No startups have been enrolled in this cohort yet."
          />
        ))}

      {/* Milestones Inbox — both roles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Milestones Inbox</CardTitle>
              {submittedMilestones && submittedMilestones.length > 0 && (
                <Badge variant="warning">{submittedMilestones.length}</Badge>
              )}
            </div>
            <CardDescription>Milestones awaiting review</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {submittedMilestones === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : submittedMilestones.length > 0 ? (
            <div className="max-h-[13rem] overflow-y-auto space-y-2">
              {submittedMilestones.map((m) => (
                <Link
                  key={m._id}
                  href={`/admin/${cohortSlug}/milestones/${m._id}`}
                  className="flex items-center justify-between gap-4 border px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{m.startupName}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground truncate">{m.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Submitted{' '}
                      {new Date(m._creationTime).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                  <div className="text-sm font-medium shrink-0">
                    £{m.amount.toLocaleString('en-GB')}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
              <Inbox className="h-5 w-5" />
              No milestones pending review
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invoices — super_admin or delegated approve_invoices */}
      {showInvoices && recentInvoices && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending Invoices</CardTitle>
              <Link href={`/admin/${cohortSlug}/invoices`}>
                <Button variant="link" size="sm" className="h-auto p-0">
                  View all →
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const pending = recentInvoices.filter(
                (i) => i.status === 'submitted' || i.status === 'under_review'
              )
              if (pending.length === 0) {
                return <p className="text-sm text-muted-foreground py-2">No pending invoices</p>
              }
              return (
                <div className="max-h-[13rem] overflow-y-auto space-y-2">
                  {pending.map((inv) => (
                    <div
                      key={inv._id}
                      className="flex items-center justify-between gap-4 border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{inv.vendorName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(inv.invoiceDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={inv.status === 'submitted' ? 'warning' : 'info'}>
                          {inv.status === 'under_review' ? 'under review' : inv.status}
                        </Badge>
                        <span className="text-sm font-medium">
                          £{inv.amountGbp.toLocaleString('en-GB')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* Super admin extras: Upcoming Events */}
      {isSuperAdmin && upcomingEvents && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Upcoming Events</CardTitle>
              <Link href={`/admin/${cohortSlug}/events`}>
                <Button variant="link" size="sm" className="h-auto p-0">
                  View all →
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const now = new Date().toISOString()
              const upcoming = upcomingEvents
                .filter((e) => e.isActive && e.date >= now)
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 3)
              if (upcoming.length === 0) {
                return <p className="text-sm text-muted-foreground py-2">No upcoming events</p>
              }
              return (
                <div className="max-h-[13rem] overflow-y-auto space-y-2">
                  {upcoming.map((evt) => (
                    <div
                      key={evt._id}
                      className="flex items-center justify-between gap-4 border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{evt.title}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(evt.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and workflows</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Link href={`/admin/${cohortSlug}/funding`}>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center">
                <Target className="mr-2 h-4 w-4" />
                {isSuperAdmin ? 'Manage Funding' : 'View Funding'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/admin/${cohortSlug}/funding/templates`}>
            <Button variant="outline" className="w-full justify-between">
              Milestone Templates
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          {isSuperAdmin && (
            <>
              <Link href={`/admin/${cohortSlug}/startups/new`}>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Startup
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/admin/cohorts">
                <Button variant="outline" className="w-full justify-between">
                  Manage Cohorts
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/admin/${cohortSlug}/invoices`}>
                <Button variant="outline" className="w-full justify-between">
                  Review Invoices
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
