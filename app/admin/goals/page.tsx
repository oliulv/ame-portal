'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Plus, Target, Edit, Trash2 } from 'lucide-react'

interface GoalTemplate {
  id: string
  title: string
  description: string
  category: string
  default_target_value?: number
  default_funding_amount?: number
  is_active: boolean
  cohorts?: {
    id: string
    label: string
  }
}

export default function GoalTemplatesPage() {
  const router = useRouter()
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchGoalTemplates() {
      try {
        const response = await fetch('/api/admin/goals')
        if (response.ok) {
          const data = await response.json()
          setGoalTemplates(data)
        }
      } catch (error) {
        console.error('Failed to fetch goal templates:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchGoalTemplates()
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this goal template?')) {
      return
    }

    setDeletingId(id)
    try {
      const response = await fetch(`/api/admin/goals/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete goal template')
      }

      // Remove from state
      setGoalTemplates(goalTemplates.filter((template) => template.id !== id))
      router.refresh()
    } catch (error) {
      console.error('Error deleting goal template:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete goal template')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Goal Templates</h1>
            <p className="text-muted-foreground">
              Manage default goals that are automatically assigned to new startups
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

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
                <TableHead>Target (Number)</TableHead>
                <TableHead>Funding (GBP)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goalTemplates.map((template) => (
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
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/goals/${template.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                        disabled={deletingId === template.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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

