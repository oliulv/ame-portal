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
import { ArrowLeft, Edit, Users, Target } from 'lucide-react'

interface CohortDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CohortDetailPage({ params }: CohortDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch cohort details
  const { data: cohort, error } = await supabase
    .from('cohorts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !cohort) {
    notFound()
  }

  // Fetch startups in this cohort
  const { data: startups } = await supabase
    .from('startups')
    .select('*')
    .eq('cohort_id', id)
    .order('name')

  // Fetch goal templates for this cohort
  const { data: goalTemplates } = await supabase
    .from('goal_templates')
    .select('*')
    .eq('cohort_id', id)
    .order('category')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/cohorts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{cohort.label}</h1>
              <Badge variant={cohort.is_active ? 'success' : 'secondary'}>
                {cohort.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-muted-foreground">{cohort.name}</p>
          </div>
        </div>
        <Link href={`/admin/cohorts/${id}/edit`}>
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Edit Cohort
          </Button>
        </Link>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Program Years</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cohort.year_start} - {cohort.year_end}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Startups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{startups?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goal Templates</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goalTemplates?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Startups Table */}
      <Card>
        <CardHeader>
          <CardTitle>Startups in this Cohort</CardTitle>
          <CardDescription>
            All startups enrolled in {cohort.label}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {startups && startups.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {startups.map((startup) => (
                  <TableRow key={startup.id}>
                    <TableCell className="font-medium">{startup.name}</TableCell>
                    <TableCell>{startup.sector || '-'}</TableCell>
                    <TableCell>{startup.stage || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/startups/${startup.slug}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No startups in this cohort yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Goal Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Goal Templates</CardTitle>
          <CardDescription>
            Default goals assigned to new startups in this cohort
          </CardDescription>
        </CardHeader>
        <CardContent>
          {goalTemplates && goalTemplates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Target Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goalTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {template.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{template.default_target_value || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={template.is_active ? 'success' : 'secondary'}>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/goals/${template.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No goal templates configured for this cohort
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
