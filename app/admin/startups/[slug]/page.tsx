import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
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
import { ArrowLeft, Edit, UserPlus, Target, Users, Mail, ExternalLink } from 'lucide-react'

interface StartupDetailPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function StartupDetailPage({ params }: StartupDetailPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch startup details with cohort info by slug
  const { data: startup, error } = await supabase
    .from('startups')
    .select(
      `
      *,
      cohorts (
        id,
        label
      )
    `
    )
    .eq('slug', slug)
    .single()

  if (error || !startup) {
    notFound()
  }

  // Fetch goals for this startup (using id for foreign key relationships)
  const { data: goals } = await supabase
    .from('startup_goals')
    .select('*')
    .eq('startup_id', startup.id)
    .order('created_at')

  // Fetch invitations for this startup
  const { data: invitations } = await supabase
    .from('invitations')
    .select('*')
    .eq('startup_id', startup.id)
    .order('created_at', { ascending: false })

  // Fetch invoices for this startup
  const { data: _invoices } = await supabase
    .from('invoices')
    .select('id, status, amount, created_at')
    .eq('startup_id', startup.id)
    .order('created_at', { ascending: false })
    .limit(5)

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
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{startup.name}</h1>
            <p className="text-muted-foreground">
              {(startup.cohorts as { label: string } | null)?.label || 'No cohort'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
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
              {invitations?.filter((i) => i.status === 'accepted').length || 0}
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
              {startup.website_url ? (
                <a
                  href={startup.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center"
                >
                  {startup.website_url}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              ) : (
                '-'
              )}
            </p>
          </div>
          {startup.notes && (
            <div className="md:col-span-2">
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
                  const isAccepted = !!invitation.accepted_at
                  const isExpired = !isAccepted && new Date(invitation.expires_at) < new Date()
                  const status = isAccepted ? 'accepted' : isExpired ? 'expired' : 'pending'

                  return (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.full_name}</TableCell>
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
                        {new Date(invitation.created_at).toLocaleDateString()}
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
                  key={goal.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
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
                    <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                  </div>
                  {goal.funding_amount && (
                    <div className="text-right ml-4">
                      <div className="text-sm font-medium">
                        £{goal.funding_amount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">Funding</div>
                    </div>
                  )}
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
