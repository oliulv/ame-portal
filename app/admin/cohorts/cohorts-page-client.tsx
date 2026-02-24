'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Users, ExternalLink } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface CohortsPageClientProps {
  isSuperAdmin: boolean
}

export function CohortsPageClient({ isSuperAdmin }: CohortsPageClientProps) {
  const cohorts = useQuery(api.cohorts.list)

  if (cohorts === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          {isSuperAdmin && <Skeleton className="h-10 w-32" />}
        </div>
        <Card>
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cohorts</h1>
          <p className="text-muted-foreground">Manage your accelerator cohorts and programs</p>
        </div>
        {isSuperAdmin && (
          <Link href="/admin/cohorts/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Cohort
            </Button>
          </Link>
        )}
      </div>

      {cohorts && cohorts.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Years</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohorts.map((cohort) => (
                <TableRow key={cohort._id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{cohort.label}</span>
                      <span className="text-sm text-muted-foreground">{cohort.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {cohort.yearStart} - {cohort.yearEnd}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cohort.isActive ? 'success' : 'secondary'}>
                      {cohort.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {isSuperAdmin && (
                      <Link href={`/admin/cohorts/${cohort.slug}/edit`}>
                        <Button variant="ghost" size="sm">
                          Edit
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No cohorts yet"
          description="Get started by creating your first cohort to onboard startups."
          action={
            isSuperAdmin ? (
              <Link href="/admin/cohorts/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Cohort
                </Button>
              </Link>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
