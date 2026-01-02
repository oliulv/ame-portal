import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Edit,
  UserPlus,
  Target,
  Users,
  Mail,
  ExternalLink,
  Plug,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { GoalsSection } from './GoalsSection'
import { InvitationsTable } from './InvitationsTable'
import { cached, cacheKeys, cacheTTL } from '@/lib/cache'

interface StartupDetailPageProps {
  params: Promise<{
    cohortSlug: string
    slug: string
  }>
}

export default async function StartupDetailPage({ params }: StartupDetailPageProps) {
  const { cohortSlug, slug } = await params
  const supabase = await createClient()

  // Fetch startup details with cohort info by slug (cached)
  const startup = await cached(
    cacheKeys.startup(slug),
    async () => {
      const { data, error } = await supabase
        .from('startups')
        .select(
          `
          *,
          cohorts (
            id,
            slug,
            label
          )
        `
        )
        .eq('slug', slug)
        .single()
      if (error || !data) return null
      return data
    },
    cacheTTL.startup
  )

  if (!startup) {
    notFound()
  }

  // Verify the startup belongs to the cohort in the URL
  const cohort = startup.cohorts as { id: string; slug: string; label: string } | null
  if (cohort?.slug !== cohortSlug) {
    notFound()
  }

  // Fetch all related data in parallel (instead of sequentially)
  const [
    { data: goals },
    { data: invitations },
    { data: bankDetails },
    { data: _invoices },
    { data: integrations },
  ] = await Promise.all([
    // Goals
    supabase.from('startup_goals').select('*').eq('startup_id', startup.id).order('created_at'),
    // Invitations
    supabase
      .from('invitations')
      .select('id, full_name, email, accepted_at, created_at, expires_at')
      .eq('startup_id', startup.id)
      .order('created_at', { ascending: false }),
    // Bank details
    supabase.from('bank_details').select('*').eq('startup_id', startup.id).single(),
    // Invoices
    supabase
      .from('invoices')
      .select('id, status, amount, created_at')
      .eq('startup_id', startup.id)
      .order('created_at', { ascending: false })
      .limit(5),
    // Integrations
    supabase
      .from('integration_connections')
      .select('*')
      .eq('startup_id', startup.id)
      .eq('is_active', true),
  ])

  // Fetch founder profiles for accepted invitations (depends on invitations result)
  const acceptedEmails = invitations?.filter((i) => i.accepted_at).map((i) => i.email) || []
  const { data: founderProfiles } =
    acceptedEmails.length > 0
      ? await supabase
          .from('founder_profiles')
          .select('*')
          .eq('startup_id', startup.id)
          .in('personal_email', acceptedEmails)
      : { data: null }

  // Create a map of email -> founder profile for easy lookup
  const founderProfileMap = new Map(founderProfiles?.map((fp) => [fp.personal_email, fp]) || [])

  // Format dates on the server to avoid hydration mismatches
  const formattedInvitations =
    invitations?.map((invitation) => ({
      ...invitation,
      created_at_formatted: new Date(invitation.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      founderProfile: founderProfileMap.get(invitation.email) || null,
    })) || []

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
              {invitations?.filter((i) => i.accepted_at).length || 0}
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
          {bankDetails && (
            <div className="md:col-span-2 border-t pt-4">
              <span className="text-sm font-medium text-muted-foreground">Bank Details</span>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div>
                  <span className="text-xs text-muted-foreground">Account Holder</span>
                  <p className="text-sm font-medium">{bankDetails.account_holder_name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Bank Name</span>
                  <p className="text-sm font-medium">{bankDetails.bank_name || '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Sort Code</span>
                  <p className="text-sm font-medium font-mono">{bankDetails.sort_code}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Account Number</span>
                  <p className="text-sm font-medium font-mono">{bankDetails.account_number}</p>
                </div>
                {bankDetails.verified && (
                  <div className="md:col-span-2">
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      Verified
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {startup.notes && (
            <div className="md:col-span-2 border-t pt-4">
              <span className="text-sm font-medium text-muted-foreground">Internal Notes</span>
              <p className="mt-1 text-sm">{startup.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Status */}
      {integrations && integrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" />
              Integrations
            </CardTitle>
            <CardDescription>
              Connected external services for automated metric tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {integration.status === 'active' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium capitalize">{integration.provider}</p>
                      {integration.account_name && (
                        <p className="text-sm text-muted-foreground">{integration.account_name}</p>
                      )}
                      {integration.last_synced_at && (
                        <p className="text-xs text-muted-foreground">
                          Last synced: {new Date(integration.last_synced_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={integration.status === 'active' ? 'default' : 'destructive'}>
                    {integration.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
          <InvitationsTable invitations={formattedInvitations} />
        </CardContent>
      </Card>

      {/* Goals */}
      <GoalsSection goals={goals || []} startupSlug={slug} />
    </div>
  )
}
