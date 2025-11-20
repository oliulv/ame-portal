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
import { Plus, Target, Edit, Trash2, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface GoalTemplate {
  id: string
  title: string
  description: string
  category: string
  default_target_value?: number
  default_funding_amount?: number
  is_active: boolean
  display_order?: number
  cohorts?: {
    id: string
    label: string
  }
}

// Sortable row component
function SortableRow({
  template,
  onDelete,
  deletingId,
}: {
  template: GoalTemplate
  onDelete: (id: string) => void
  deletingId: string | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: template.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-10">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
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
            onClick={() => onDelete(template.id)}
            disabled={deletingId === template.id}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function GoalTemplatesPage() {
  const router = useRouter()
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = goalTemplates.findIndex((item) => item.id === active.id)
    const newIndex = goalTemplates.findIndex((item) => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Save the old order for potential revert
    const oldOrder = [...goalTemplates]

    // Optimistically update the UI
    const newOrder = arrayMove(goalTemplates, oldIndex, newIndex)
    setGoalTemplates(newOrder)

    // Update the order in the database
    setIsReordering(true)
    try {
      const goalIds = newOrder.map((template) => template.id)
      const response = await fetch('/api/admin/goals/reorder', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ goalIds }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reorder goals')
      }

      router.refresh()
    } catch (error) {
      console.error('Error reordering goals:', error)
      // Revert on error
      setGoalTemplates(oldOrder)
      alert(error instanceof Error ? error.message : 'Failed to reorder goals')
    } finally {
      setIsReordering(false)
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
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
                <SortableContext
                  items={goalTemplates.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {goalTemplates.map((template) => (
                    <SortableRow
                      key={template.id}
                      template={template}
                      onDelete={handleDelete}
                      deletingId={deletingId}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
          {isReordering && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Updating order...
            </div>
          )}
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

