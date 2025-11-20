'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Target, FileText, Building2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { goalsApi } from '@/lib/api/goals'
import { queryKeys } from '@/lib/queryKeys'
import { StartupGoal } from '@/lib/types'

export default function FounderDashboard() {
  // Fetch founder goals to calculate stats
  const { data: goals = [], isLoading: isLoadingGoals } = useQuery({
    queryKey: queryKeys.goals.list('founder'),
    queryFn: () => goalsApi.getFounderGoals(),
    staleTime: 1000 * 60, // 1 minute - realtime handles most updates
  })

  // Calculate stats from goals
  const completedGoals = goals.filter(g => g.status === 'completed').length
  const totalGoals = goals.length
  const progressPercentage = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0

  // For now, we'll use a simplified version since we don't have API endpoints for startups/invoices yet
  // In a real implementation, you'd create API endpoints and use them here
  const isLoading = isLoadingGoals
  const hasStartups = goals.length > 0 // If there are goals, there's at least one startup

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

  if (!hasStartups) {
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's your startup progress
        </p>
      </div>

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
            <Link href="/founder/goals" className="mt-3 inline-block">
              <Button variant="link" size="sm" className="h-auto p-0">
                View all goals →
              </Button>
            </Link>
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-2">
              All caught up!
            </p>
            <Link href="/founder/invoices" className="mt-3 inline-block">
              <Button variant="link" size="sm" className="h-auto p-0">
                View invoices →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
