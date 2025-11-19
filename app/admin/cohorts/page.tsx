import { createClient } from '@/lib/supabase/server'
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

export default async function CohortsPage() {
  const supabase = await createClient()
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('*')
    .order('year_start', { ascending: false })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cohorts</h1>
          <p className="text-muted-foreground">
            Manage your accelerator cohorts and programs
          </p>
        </div>
        <Link href="/admin/cohorts/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Cohort
          </Button>
        </Link>
      </div>

      {/* Table */}
      {cohorts && cohorts.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Years</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohorts.map((cohort) => (
                <TableRow key={cohort.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{cohort.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {cohort.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {cohort.year_start} - {cohort.year_end}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cohort.is_active ? 'success' : 'secondary'}>
                      {cohort.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/cohorts/${cohort.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Button>
                    </Link>
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
            <Link href="/admin/cohorts/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Cohort
              </Button>
            </Link>
          }
        />
      )}
    </div>
  )
}

