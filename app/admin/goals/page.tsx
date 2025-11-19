import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Plus, Target, Edit } from 'lucide-react'

export default async function GoalTemplatesPage() {
  const supabase = await createClient()

  // Fetch all goal templates with cohort info
  const { data: goalTemplates } = await supabase
    .from('goal_templates')
    .select(`
      id,
      title,
      description,
      category,
      default_target_value,
      default_funding_amount,
      is_active,
      cohorts (
        id,
        label
      )
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Goal Templates</h1>
          <p className="text-muted-foreground">
            Manage default goals that are automatically assigned to new startups
          </p>
        </div>
        <Link href="/admin/goals/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Goal Template
          </Button>
        </Link>
      </div>

      {/* Table */}
      {goalTemplates && goalTemplates.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Cohort</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Funding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goalTemplates.map((template: any) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{template.title}</span>
                      <span className="text-sm text-muted-foreground line-clamp-1">
                        {template.description}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {template.cohorts?.label || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {template.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {template.default_target_value || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {template.default_funding_amount
                        ? `£${template.default_funding_amount.toLocaleString()}`
                        : '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={template.is_active ? 'success' : 'secondary'}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/goals/${template.id}/edit`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="mr-2 h-3 w-3" />
                        Edit
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
          icon={<Target className="h-6 w-6" />}
          title="No goal templates yet"
          description="Create goal templates that will be automatically assigned to new startups in your cohorts."
          action={
            <Link href="/admin/goals/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Goal Template
              </Button>
            </Link>
          }
        />
      )}
    </div>
  )
}

