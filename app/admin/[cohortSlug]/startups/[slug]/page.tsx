'use client'

import { useParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Edit, UserPlus, Target, Users, Mail, ExternalLink, Plug } from 'lucide-react'

export default function StartupDetailPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const slug = params.slug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const startup = useQuery(api.startups.getBySlug, { slug })
  const goals = useQuery(
    api.startupGoals.listByStartup,
    startup ? { startupId: startup._id } : 'skip'
  )
  const invitations = useQuery(api.invitations.list, startup ? { startupId: startup._id } : 'skip')
  const invoices = useQuery(
    api.invoices.listForAdmin,
    startup ? { startupId: startup._id } : 'skip'
  )

  // Loading state
  if (startup === undefined || cohort === undefined) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-36" />
            <div>
              <Skeleton className="h-9 w-64" />
              <Skeleton className="mt-1 h-5 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Details skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>

        {/* Invitations skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>

        {/* Goals skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Not found
  if (startup === null || cohort === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h1 className="text-2xl font-bold">Startup not found</h1>
        <p className="mt-2 text-muted-foreground">
          The startup you are looking for does not exist or does not belong to this cohort.
        </p>
        <Link href={`/admin/${cohortSlug}/startups`} className="mt-4">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Startups
          </Button>
        </Link>
      </div>
    )
  }

  const goalStats = {
    total: goals?.length || 0,
    completed: goals?.filter((g) => g.status === 'completed').length || 0,
    inProgress: goals?.filter((g) => g.status === 'in_progress').length || 0,
    notStarted: goals?.filter((g) => g.status === 'not_started').length || 0,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/admin/${cohortSlug}/startups`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Startups
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{startup.name}</h1>
            <p className="text-muted-foreground">{cohort?.label || 'No cohort'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/${cohortSlug}/startups/${slug}/analytics`}>
            <Button variant="outline">
              <Plug className="mr-2 h-4 w-4" />
              Analytics
            </Button>
          </Link>
          <Link href={`/admin/startups/${slug}/invite`}>
            <Button variant="default">
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Founder
            </Button>
          </Link>
          <Link href={`/admin/startups/${slug}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goalStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Target
              className={`h-4 w-4 ${goalStats.completed > 0 ? 'text-green-600' : 'text-muted-foreground'}`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${goalStats.completed > 0 ? 'text-green-600' : ''}`}
            >
              {goalStats.completed}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Founders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {invitations?.filter((i) => i.acceptedAt).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invitations</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invitations?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Startup Details */}
      <Card>
        <CardHeader>
          <CardTitle>Startup Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="text-sm font-medium text-muted-foreground">Sector</span>
            <p className="mt-1">{startup.sector || '-'}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">Website</span>
            <p className="mt-1">
              {startup.websiteUrl ? (
                <a
                  href={startup.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center"
                >
                  {startup.websiteUrl}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              ) : (
                '-'
              )}
            </p>
          </div>
          {startup.notes && (
            <div className="md:col-span-2 border-t pt-4">
              <span className="text-sm font-medium text-muted-foreground">Internal Notes</span>
              <p className="mt-1 text-sm">{startup.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Founders & Invitations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Founders & Invitations</CardTitle>
              <CardDescription>Team members and pending invitations</CardDescription>
            </div>
            <Link href={`/admin/startups/${slug}/invite`}>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Founder
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {invitations && invitations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => {
                  const isAccepted = !!invitation.acceptedAt
                  const isExpired =
                    !isAccepted && invitation.expiresAt
                      ? new Date(invitation.expiresAt) < new Date()
                      : false
                  const status = isAccepted ? 'accepted' : isExpired ? 'expired' : 'pending'

                  return (
                    <TableRow key={invitation._id}>
                      <TableCell className="font-medium">{invitation.fullName}</TableCell>
                      <TableCell>{invitation.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status === 'accepted'
                              ? 'success'
                              : status === 'expired'
                                ? 'destructive'
                                : 'info'
                          }
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(invitation._creationTime).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No founders invited yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader>
          <CardTitle>Goals</CardTitle>
          <CardDescription>Assigned goals and progress</CardDescription>
        </CardHeader>
        <CardContent>
          {goals && goals.length > 0 ? (
            <div className="space-y-4">
              {goals.map((goal) => (
                <div
                  key={goal._id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{goal.title}</span>
                      <Badge variant="outline" className="capitalize">
                        {goal.category}
                      </Badge>
                      <Badge
                        variant={
                          goal.status === 'completed'
                            ? 'success'
                            : goal.status === 'in_progress'
                              ? 'info'
                              : 'secondary'
                        }
                      >
                        {goal.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    {goal.description && (
                      <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                    )}
                    {goal.targetValue && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Target: {goal.targetValue}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {goal.fundingAmount && (
                      <div className="text-right mr-4">
                        <div className="text-sm font-medium">
                          £{goal.fundingAmount.toLocaleString('en-GB')}
                        </div>
                        <div className="text-xs text-muted-foreground">Funding</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No goals assigned yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
