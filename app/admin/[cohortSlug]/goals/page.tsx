'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { toast } from 'sonner'
import { extractConditionsFromDescription } from '@/lib/goalUtils'
import type { Id } from '@/convex/_generated/dataModel'

// Type for goal templates from Convex
interface GoalTemplate {
  _id: Id<'goalTemplates'>
  _creationTime: number
  cohortId: Id<'cohorts'>
  title: string
  description?: string
  category?: string
  defaultTargetValue?: number
  defaultDeadline?: string
  defaultWeight: number
  defaultFundingAmount?: number
  isActive: boolean
  sortOrder?: number
}

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
          <span className="text-sm text-muted-foreground line-clamp-1">{description}</span>
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
  template: GoalTemplate
  onDelete: (id: Id<'goalTemplates'>) => void
  deletingId: Id<'goalTemplates'> | null
  orderNumber: number
  cohortSlug: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: template._id,
  })

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
        <span className="text-sm">{template.defaultTargetValue || '-'}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm">
          {template.defaultFundingAmount
            ? `£${template.defaultFundingAmount.toLocaleString()}`
            : '-'}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={template.isActive ? 'success' : 'secondary'}>
          {template.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={
              cohortSlug
                ? `/admin/${cohortSlug}/goals/${template._id}/edit`
                : `/admin/goals/${template._id}/edit`
            }
          >
            <Button variant="ghost" size="sm">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(template._id)}
            disabled={deletingId === template._id}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

interface AccelerateMeGoal {
  _id: Id<'goalTemplates'>
  cohortId: Id<'cohorts'>
  title: string
  description: string
}

export default function GoalTemplatesPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })

  const allGoals = useQuery(api.goalTemplates.list, cohort?._id ? { cohortId: cohort._id } : 'skip')

  const removeGoal = useMutation(api.goalTemplates.remove)
  const reorderGoals = useMutation(api.goalTemplates.reorder)
  const cleanupDuplicatesMutation = useMutation(api.goalTemplates.cleanupDuplicates)
  const updateGoalMutation = useMutation(api.goalTemplates.update)
  const createGoalMutation = useMutation(api.goalTemplates.create)

  const [deletingId, setDeletingId] = useState<Id<'goalTemplates'> | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAccelerateMeGoal, setEditingAccelerateMeGoal] = useState<AccelerateMeGoal | null>(
    null
  )
  const [accelerateMeTitle, setAccelerateMeTitle] = useState('Join AccelerateMe')
  const [accelerateMeDescription, setAccelerateMeDescription] = useState(
    'Welcome to the program! Your journey starts here.'
  )
  const [isSavingAccelerateMe, setIsSavingAccelerateMe] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const isLoading = cohort === undefined || allGoals === undefined

  // Separate AccelerateMe goals from regular goals
  const allGoalsList = allGoals ?? []
  const accelerateMeGoals = allGoalsList.filter(
    (goal) =>
      goal.title === 'Join AccelerateMe' || goal.title.toLowerCase().includes('join accelerateme')
  )
  const accelerateMeGoalFound = accelerateMeGoals[0]
  const hasDuplicateAccelerateMe = accelerateMeGoals.length > 1

  const accelerateMeGoal: AccelerateMeGoal | null = accelerateMeGoalFound
    ? {
        _id: accelerateMeGoalFound._id,
        cohortId: accelerateMeGoalFound.cohortId,
        title: accelerateMeGoalFound.title,
        description: accelerateMeGoalFound.description || '',
      }
    : null

  const goalTemplates: GoalTemplate[] = allGoalsList.filter(
    (goal) =>
      goal.title !== 'Join AccelerateMe' && !goal.title.toLowerCase().includes('join accelerateme')
  )

  const hasDefaultGoal = !!accelerateMeGoal

  async function handleCleanupDuplicates() {
    if (!cohort?._id) return
    setIsCleaningUp(true)
    try {
      await cleanupDuplicatesMutation({ cohortId: cohort._id })
      toast.success('Duplicate goals cleaned up successfully')
    } catch (error) {
      console.error('Failed to cleanup duplicates:', error)
      toast.error('Failed to cleanup duplicates')
    } finally {
      setIsCleaningUp(false)
    }
  }

  async function handleDelete(id: Id<'goalTemplates'>) {
    if (!confirm('Are you sure you want to delete this goal template?')) {
      return
    }

    setDeletingId(id)
    try {
      await removeGoal({ id })
      toast.success('Goal template deleted successfully')
    } catch (error) {
      console.error('Failed to delete goal:', error)
      toast.error('Failed to delete goal template')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = goalTemplates.findIndex((item) => item._id === active.id)
    const newIndex = goalTemplates.findIndex((item) => item._id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    const newOrder = arrayMove(goalTemplates, oldIndex, newIndex)

    setIsReordering(true)
    try {
      await reorderGoals({ goalIds: newOrder.map((t) => t._id) })
      toast.success('Goals reordered successfully')
    } catch (error) {
      console.error('Failed to reorder goals:', error)
      toast.error('Failed to reorder goals')
    } finally {
      setIsReordering(false)
    }
  }

  async function handleSaveAccelerateMe() {
    if (!editingAccelerateMeGoal || !cohort?._id) return

    setIsSavingAccelerateMe(true)
    try {
      await updateGoalMutation({
        id: editingAccelerateMeGoal._id,
        cohortId: editingAccelerateMeGoal.cohortId,
        title: accelerateMeTitle,
        description: accelerateMeDescription,
        category: 'launch',
        isActive: true,
      })
      toast.success('Goal updated successfully')
      setIsEditDialogOpen(false)
      setEditingAccelerateMeGoal(null)
    } catch (error) {
      console.error('Failed to update AccelerateMe goal:', error)
      toast.error('Failed to update goal')
    } finally {
      setIsSavingAccelerateMe(false)
    }
  }

  async function handleCreateDefaultGoal() {
    if (!cohort?._id) return
    try {
      await createGoalMutation({
        cohortId: cohort._id,
        title: 'Join AccelerateMe',
        description: 'Welcome to the program! Your journey starts here.',
        category: 'launch',
        isActive: true,
        defaultWeight: 1,
      })
      toast.success('Default goal created successfully')
    } catch (error) {
      console.error('Failed to create default goal:', error)
      toast.error('Failed to create default goal. Please try again.')
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

  if (!cohort) {
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
            Manage default goals for <span className="font-medium">{cohort.label}</span> that are
            automatically assigned to new startups
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
      {hasDuplicateAccelerateMe && cohort._id && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-900">
                  Duplicate &quot;Join AccelerateMe&quot; goals detected
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  Found {accelerateMeGoals.length} duplicate goal(s). Only one should exist per
                  cohort.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCleanupDuplicates}
                disabled={isCleaningUp}
              >
                {isCleaningUp ? 'Cleaning up...' : 'Clean Up Duplicates'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning if default goal is missing */}
      {!hasDefaultGoal && cohort._id && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Default &quot;Join AccelerateMe&quot; goal is missing
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  This goal should exist for each cohort. It will be created automatically for new
                  cohorts.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleCreateDefaultGoal}>
                Create Default Goal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {goalTemplates.length > 0 || accelerateMeGoal ? (
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
                    key={accelerateMeGoal._id}
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
                  items={goalTemplates.map((t) => t._id)}
                  strategy={verticalListSortingStrategy}
                >
                  {goalTemplates.map((template, index) => (
                    <SortableRow
                      key={template._id}
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
            <div className="p-4 text-center text-sm text-muted-foreground">Updating order...</div>
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
              Edit the title and description for the &quot;Join AccelerateMe&quot; goal that appears
              first to founders in {cohort?.label || 'this cohort'}.
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
            <Button onClick={handleSaveAccelerateMe} disabled={isSavingAccelerateMe}>
              {isSavingAccelerateMe ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
