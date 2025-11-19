import { createClient } from '@/lib/supabase/server'
import { getFounderStartupIds } from '@/lib/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Target, FileText, Building2, TrendingUp } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function FounderDashboard() {
  const startupIds = await getFounderStartupIds()
  const supabase = await createClient()

  if (startupIds.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
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

  // Get startup data
  const { data: startups } = await supabase
    .from('startups')
    .select('id, name, onboarding_status')
    .in('id', startupIds)

  // Get goals summary
  const { data: goals } = await supabase
    .from('startup_goals')
    .select('id, status')
    .in('startup_id', startupIds)

  const completedGoals = goals?.filter(g => g.status === 'completed').length || 0
  const totalGoals = goals?.length || 0
  const progressPercentage = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0

  // Get invoices summary
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, status')
    .in('startup_id', startupIds)

  const pendingInvoices = invoices?.filter(i => i.status === 'submitted' || i.status === 'under_review').length || 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's your startup progress
        </p>
      </div>

      {/* Startup Cards */}
      {startups && startups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Startup{startups.length > 1 ? 's' : ''}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {startups.map((startup) => (
              <Card key={startup.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {startup.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Onboarding</span>
                    <Badge variant={startup.onboarding_status === 'complete' ? 'success' : 'warning'}>
                      {startup.onboarding_status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Goals Progress
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalGoals > 0 ? `${completedGoals}/${totalGoals}` : '0'}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{progressPercentage}%</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {totalGoals - completedGoals} remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Invoices
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInvoices}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {pendingInvoices === 0 ? 'All caught up!' : 'Awaiting review'}
            </p>
            {pendingInvoices > 0 && (
              <Link href="/founder/invoices" className="mt-3 inline-block">
                <Button variant="link" size="sm" className="h-auto p-0">
                  View invoices →
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

