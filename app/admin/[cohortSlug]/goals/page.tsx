'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { queryKeys } from '@/lib/queryKeys'
import { goalsApi, type GoalTemplateWithCohort } from '@/lib/api/goals'
import { useAppMutation } from '@/lib/hooks/useAppMutation'
import { useSelectedCohort } from '@/lib/hooks/useSelectedCohort'
import { useQueryClient } from '@tanstack/react-query'
import { type GoalTemplateFormData } from '@/lib/schemas'
import { extractConditionsFromDescription } from '@/lib/goalUtils'

// Special row for "Join AccelerateMe" goal (non-draggable, always first)
function AccelerateMeRow({
  title,
  description,
  onEdit,
}: {
  title: string
  description: string
  onEdit: () => void
}) {
  return (
    <TableRow>
      <TableCell className="w-20">
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs font-bold">
          1
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{title}</span>
          <span className="text-sm text-muted-foreground line-clamp-1">
            {description}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize">
          launch
        </Badge>
      </TableCell>
      <TableCell>
        <span className="text-sm">-</span>
      </TableCell>
      <TableCell>
        <span className="text-sm">-</span>
      </TableCell>
      <TableCell>
        <Badge variant="success">Active</Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

// Sortable row component
function SortableRow({
  template,
  onDelete,
  deletingId,
  orderNumber,
  cohortSlug,
}: {
  template: GoalTemplateWithCohort
  onDelete: (id: string) => void
  deletingId: string | null
  orderNumber: number
  cohortSlug: string | null
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
      <TableCell className="w-20">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs font-bold">
            {orderNumber}
          </div>
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{template.title}</span>
          <span className="text-sm text-muted-foreground line-clamp-1">
            {extractConditionsFromDescription(template.description).cleanDescription || '-'}
          </span>
        </div>
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
          <Link href={cohortSlug ? `/admin/${cohortSlug}/goals/${template.id}/edit` : `/admin/goals/${template.id}/edit`}>
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

interface AccelerateMeGoal {
  id: string
  cohort_id: string
  title: string
  description: string
}

export default function GoalTemplatesPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const queryClient = useQueryClient()
  const { cohortId, cohort, isLoading: isLoadingCohort } = useSelectedCohort()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAccelerateMeGoal, setEditingAccelerateMeGoal] = useState<AccelerateMeGoal | null>(null)
  const [accelerateMeTitle, setAccelerateMeTitle] = useState('Join AccelerateMe')
  const [accelerateMeDescription, setAccelerateMeDescription] = useState('Welcome to the program! Your journey starts here.')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Fetch goal templates filtered by selected cohort using TanStack Query
  const { data: allGoals = [], isLoading } = useQuery({
    queryKey: queryKeys.goals.list('admin', { cohortId }),
    queryFn: () => goalsApi.getAll(cohortId || undefined),
    enabled: !!cohortId, // Only fetch when a cohort is selected
  })

  // Separate AccelerateMe goals from regular goals
  // Only keep the first "Join AccelerateMe" goal to avoid duplicates
  const goalTemplates: GoalTemplateWithCohort[] = []
  const accelerateMeGoals = allGoals.filter((goal) => 
    goal.title === 'Join AccelerateMe' || goal.title.toLowerCase().includes('join accelerateme')
  )
  const accelerateMeGoalFound = accelerateMeGoals[0]
  const hasDuplicateAccelerateMe = accelerateMeGoals.length > 1
  
  const accelerateMeGoal: AccelerateMeGoal | null = accelerateMeGoalFound ? {
    id: accelerateMeGoalFound.id,
    cohort_id: accelerateMeGoalFound.cohorts?.id || '',
    title: accelerateMeGoalFound.title,
    description: accelerateMeGoalFound.description || '',
  } : null
  
  allGoals.forEach((goal) => {
    if (goal.title !== 'Join AccelerateMe' && !goal.title.toLowerCase().includes('join accelerateme')) {
      goalTemplates.push(goal)
    }
    // Note: We're ignoring duplicate "Join AccelerateMe" goals
    // They should be cleaned up from the database
  })

  // Check if default "Join AccelerateMe" goal is missing
  const hasDefaultGoal = !!accelerateMeGoal

  const cleanupDuplicates = useAppMutation<void, void>({
    mutationFn: async () => {
      const response = await fetch('/api/admin/goals/cleanup-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort_id: cohortId }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cleanup duplicates')
      }
      return response.json()
    },
    invalidateQueries: [queryKeys.goals.list('admin', { cohortId })],
    successMessage: 'Duplicate goals cleaned up successfully',
  })

  const deleteGoal = useAppMutation({
    mutationFn: (id: string) => goalsApi.delete(id),
    invalidateQueries: [queryKeys.goals.list('admin', { cohortId })],
    successMessage: 'Goal template deleted successfully',
  })

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this goal template?')) {
      return
    }

    setDeletingId(id)
    deleteGoal.mutate(id, {
      onSettled: () => {
        setDeletingId(null)
      },
    })
  }

  const reorderGoals = useAppMutation({
    mutationFn: (goalIds: string[]) => goalsApi.reorder(goalIds),
    invalidateQueries: [queryKeys.goals.list('admin', { cohortId })],
    successMessage: 'Goals reordered successfully',
  })

  const updateAccelerateMeGoal = useAppMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GoalTemplateFormData> }) => 
      goalsApi.update(id, data),
    invalidateQueries: [queryKeys.goals.list('admin', { cohortId })],
    successMessage: 'Goal updated successfully',
    onSuccess: () => {
      setIsEditDialogOpen(false)
      setEditingAccelerateMeGoal(null)
    },
  })

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
    
    // Optimistically update the query cache
    queryClient.setQueryData(queryKeys.goals.list('admin', { cohortId }), (old: GoalTemplateWithCohort[] = []) => {
      const accelerateMeGoal = old.find(g => 
        g.title === 'Join AccelerateMe' || g.title.toLowerCase().includes('join accelerateme')
      )
      const regularGoals = old.filter(g => 
        g.title !== 'Join AccelerateMe' && !g.title.toLowerCase().includes('join accelerateme')
      )
      const reorderedRegularGoals = arrayMove(
        regularGoals,
        regularGoals.findIndex(g => g.id === active.id),
        regularGoals.findIndex(g => g.id === over.id)
      )
      return accelerateMeGoal ? [accelerateMeGoal, ...reorderedRegularGoals] : reorderedRegularGoals
    })

    // Update the order in the database
    setIsReordering(true)
    const goalIds = newOrder.map((template) => template.id)
    
    reorderGoals.mutate(goalIds, {
      onError: () => {
        // Revert on error
        queryClient.setQueryData(queryKeys.goals.list('admin', { cohortId }), (old: GoalTemplateWithCohort[] = []) => {
          const accelerateMeGoal = old.find(g => 
            g.title === 'Join AccelerateMe' || g.title.toLowerCase().includes('join accelerateme')
          )
          return accelerateMeGoal ? [accelerateMeGoal, ...oldOrder] : oldOrder
        })
      },
      onSettled: () => {
        setIsReordering(false)
      },
    })
  }

  if (isLoadingCohort || isLoading) {
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

  if (!cohortId || !cohort) {
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
            <EmptyState
              icon={<Target className="h-6 w-6" />}
              title="No cohort selected"
              description="Please select a cohort from the sidebar to view and manage goal templates."
            />
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
            Manage default goals for <span className="font-medium">{cohort.label}</span> that are automatically assigned to new startups
          </p>
        </div>
        <Link href={`/admin/${cohortSlug}/goals/new`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Goal Template
          </Button>
        </Link>
      </div>

      {/* Warning if duplicate goals detected */}
      {hasDuplicateAccelerateMe && cohortId && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-900">
                  Duplicate "Join AccelerateMe" goals detected
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  Found {accelerateMeGoals.length} duplicate goal(s). Only one should exist per cohort.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => cleanupDuplicates.mutate()}
                disabled={cleanupDuplicates.isPending}
              >
                {cleanupDuplicates.isPending ? 'Cleaning up...' : 'Clean Up Duplicates'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning if default goal is missing */}
      {!hasDefaultGoal && cohortId && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Default "Join AccelerateMe" goal is missing
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  This goal should exist for each cohort. It will be created automatically for new cohorts.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!cohortId) return
                  try {
                    await goalsApi.create({
                      cohortId: cohortId,
                      title: 'Join AccelerateMe',
                      description: 'Welcome to the program! Your journey starts here.',
                      category: 'launch',
                      isActive: true,
                      conditions: [
                        {
                          dataSource: 'stripe',
                          metric: '',
                          operator: '>=',
                          targetValue: 0,
                          unit: '',
                        },
                      ],
                    })
                    // Invalidate queries to refresh the list
                    queryClient.invalidateQueries({ queryKey: queryKeys.goals.list('admin', { cohortId }) })
                  } catch (error) {
                    console.error('Failed to create default goal:', error)
                    alert('Failed to create default goal. Please try again.')
                  }
                }}
              >
                Create Default Goal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {(goalTemplates.length > 0 || accelerateMeGoal) ? (
        <Card>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Order</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Target (Number)</TableHead>
                  <TableHead>Funding (GBP)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accelerateMeGoal ? (
                  <AccelerateMeRow
                    key={accelerateMeGoal.id}
                    title={accelerateMeGoal.title}
                    description={accelerateMeGoal.description}
                    onEdit={() => {
                      if (accelerateMeGoal) {
                        setEditingAccelerateMeGoal(accelerateMeGoal)
                        setAccelerateMeTitle(accelerateMeGoal.title)
                        setAccelerateMeDescription(accelerateMeGoal.description)
                        setIsEditDialogOpen(true)
                      }
                    }}
                  />
                ) : null}
                <SortableContext
                  items={goalTemplates.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {goalTemplates.map((template, index) => (
                    <SortableRow
                      key={template.id}
                      template={template}
                      onDelete={handleDelete}
                      deletingId={deletingId}
                      orderNumber={index + (accelerateMeGoal ? 1 : 0) + 1}
                      cohortSlug={cohortSlug}
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
          description={`Create goal templates that will be automatically assigned to new startups in ${cohort?.label || 'this cohort'}.`}
          action={
            <Link href={`/admin/${cohortSlug}/goals/new`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Goal Template
              </Button>
            </Link>
          }
        />
      )}

      {/* Edit AccelerateMe Goal Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Join AccelerateMe Goal</DialogTitle>
            <DialogDescription>
              Edit the title and description for the "Join AccelerateMe" goal that appears first to founders in {cohort?.label || 'this cohort'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="accelerateme-title">Title</Label>
              <Input
                id="accelerateme-title"
                value={accelerateMeTitle}
                onChange={(e) => setAccelerateMeTitle(e.target.value)}
                placeholder="Join AccelerateMe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accelerateme-description">Description</Label>
              <Textarea
                id="accelerateme-description"
                value={accelerateMeDescription}
                onChange={(e) => setAccelerateMeDescription(e.target.value)}
                placeholder="Welcome to the program! Your journey starts here."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                setEditingAccelerateMeGoal(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingAccelerateMeGoal) return
                
                updateAccelerateMeGoal.mutate({
                  id: editingAccelerateMeGoal.id,
                  data: {
                    cohortId: editingAccelerateMeGoal.cohort_id,
                    title: accelerateMeTitle,
                    description: accelerateMeDescription,
                    category: 'launch',
                    isActive: true,
                    conditions: [
                      {
                        dataSource: 'stripe',
                        metric: '',
                        operator: '>=',
                        targetValue: 0,
                        unit: '',
                      },
                    ],
                  },
                })
              }}
              disabled={updateAccelerateMeGoal.isPending}
            >
              {updateAccelerateMeGoal.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

