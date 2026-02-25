'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Check, Clock, Lock, Send, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Id } from '@/convex/_generated/dataModel'

export default function FounderFundingPage() {
  const milestones = useQuery(api.milestones.listForFounder)
  const submitMilestone = useMutation(api.milestones.submit)

  if (milestones === undefined) {
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-16 w-full" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (milestones.length === 0) {
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Funding</h1>
          <p className="text-muted-foreground">Track your milestone-based funding</p>
        </div>
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No milestones yet"
          description="Your milestones will appear here once they are set up by your program admin."
        />
      </div>
    )
  }

  const potential = milestones.reduce((sum, m) => sum + m.amount, 0)
  const unlocked = milestones
    .filter((m) => m.status === 'approved')
    .reduce((sum, m) => sum + m.amount, 0)
  const unlockedPct = potential > 0 ? (unlocked / potential) * 100 : 0

  async function handleSubmit(id: Id<'milestones'>) {
    try {
      await submitMilestone({ id })
      toast.success('Milestone submitted for review')
    } catch (error) {
      console.error('Failed to submit milestone:', error)
      toast.error('Failed to submit milestone')
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Funding</h1>
        <p className="text-muted-foreground">Track your milestone-based funding</p>
      </div>

      {/* Funding bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Funding Progress</span>
            <span className="text-sm text-muted-foreground">
              {'\u00A3'}
              {unlocked.toLocaleString('en-GB')} / {'\u00A3'}
              {potential.toLocaleString('en-GB')}
            </span>
          </div>
          <div className="h-4 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${unlockedPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{Math.round(unlockedPct)}% unlocked</p>
        </CardContent>
      </Card>

      {/* Milestones */}
      <div className="space-y-3">
        {milestones.map((milestone) => (
          <Card key={milestone._id} className={cn(milestone.status === 'locked' && 'opacity-60')}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div>
                  {milestone.status === 'approved' ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <Check className="h-5 w-5 text-green-600" />
                    </div>
                  ) : milestone.status === 'submitted' ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                  ) : milestone.status === 'active' ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <Send className="h-5 w-5 text-blue-600" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{milestone.title}</span>
                    {milestone.status === 'approved' && <Badge variant="success">Approved</Badge>}
                    {milestone.status === 'submitted' && (
                      <Badge variant="warning">Pending Review</Badge>
                    )}
                    {milestone.status === 'locked' && <Badge variant="secondary">Locked</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{milestone.description}</p>
                  {milestone.dueDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {new Date(milestone.dueDate).toLocaleDateString('en-GB')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {'\u00A3'}
                    {milestone.amount.toLocaleString('en-GB')}
                  </div>
                  {milestone.status === 'approved' && (
                    <div className="text-xs text-green-600">Unlocked</div>
                  )}
                </div>
                {milestone.status === 'active' && (
                  <Button size="sm" onClick={() => handleSubmit(milestone._id)}>
                    Submit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
