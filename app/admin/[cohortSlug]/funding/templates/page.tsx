'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { logClientError } from '@/lib/logging'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { ArrowLeft, Plus, Edit, Trash2, GripVertical, Target } from 'lucide-react'
import { toast } from 'sonner'
import type { Id, Doc } from '@/convex/_generated/dataModel'

type MilestoneTemplate = Doc<'milestoneTemplates'>

function SortableTemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: MilestoneTemplate
  onEdit: (t: MilestoneTemplate) => void
  onDelete: (id: Id<'milestoneTemplates'>) => void
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
      <TableCell className="w-12">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{template.title}</TableCell>
      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
        {template.description}
      </TableCell>
      <TableCell className="text-right">
        {'\u00A3'}
        {template.amount.toLocaleString('en-GB')}
      </TableCell>
      <TableCell>
        <Badge variant={template.isActive ? 'success' : 'secondary'}>
          {template.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(template)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(template._id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function MilestoneTemplatesPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const templates = useQuery(
    api.milestoneTemplates.list,
    cohort?._id ? { cohortId: cohort._id } : 'skip'
  )

  const createTemplate = useMutation(api.milestoneTemplates.create)
  const updateTemplate = useMutation(api.milestoneTemplates.update)
  const removeTemplate = useMutation(api.milestoneTemplates.remove)
  const reorderTemplates = useMutation(api.milestoneTemplates.reorder)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MilestoneTemplate | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDueDate, setFormDueDate] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const isLoading = cohort === undefined || templates === undefined

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Card>
          <CardContent className="py-8">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!cohort) {
    return (
      <EmptyState
        icon={<Target className="h-6 w-6" />}
        title="Cohort not found"
        description="The selected cohort could not be found."
      />
    )
  }

  function resetForm() {
    setFormTitle('')
    setFormDescription('')
    setFormAmount('')
    setFormDueDate('')
    setFormIsActive(true)
  }

  function openCreate() {
    resetForm()
    setIsCreateOpen(true)
  }

  function openEdit(template: MilestoneTemplate) {
    setFormTitle(template.title)
    setFormDescription(template.description)
    setFormAmount(String(template.amount))
    setFormDueDate(template.dueDate ?? '')
    setFormIsActive(template.isActive)
    setEditingTemplate(template)
  }

  async function handleSave() {
    const amount = parseFloat(formAmount)
    if (!formTitle || !formDescription || isNaN(amount)) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSaving(true)
    try {
      if (editingTemplate) {
        await updateTemplate({
          id: editingTemplate._id,
          title: formTitle,
          description: formDescription,
          amount,
          dueDate: formDueDate || undefined,
          isActive: formIsActive,
        })
        toast.success('Template updated')
        setEditingTemplate(null)
      } else {
        await createTemplate({
          cohortId: cohort!._id,
          title: formTitle,
          description: formDescription,
          amount,
          dueDate: formDueDate || undefined,
          isActive: formIsActive,
        })
        toast.success(
          formIsActive
            ? 'Template created and milestones assigned to existing startups'
            : 'Template created'
        )
        setIsCreateOpen(false)
      }
      resetForm()
    } catch (error) {
      logClientError('Failed to save template:', error)
      toast.error('Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: Id<'milestoneTemplates'>) {
    if (!confirm('Are you sure you want to delete this template?')) return
    try {
      await removeTemplate({ id })
      toast.success('Template deleted')
    } catch (error) {
      logClientError('Failed to delete template:', error)
      toast.error('Failed to delete template')
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !templates) return

    const oldIndex = templates.findIndex((t) => t._id === active.id)
    const newIndex = templates.findIndex((t) => t._id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = arrayMove(templates, oldIndex, newIndex)
    try {
      await reorderTemplates({ templateIds: newOrder.map((t) => t._id) })
      toast.success('Templates reordered')
    } catch (error) {
      logClientError('Failed to reorder:', error)
      toast.error('Failed to reorder templates')
    }
  }

  const templateFormDialog = (
    <Dialog
      open={isCreateOpen || !!editingTemplate}
      onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false)
          setEditingTemplate(null)
          resetForm()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingTemplate ? 'Edit Milestone Template' : 'Create Milestone Template'}
          </DialogTitle>
          <DialogDescription>
            {editingTemplate
              ? 'Update template details.'
              : 'Active templates are auto-assigned to all existing startups in the cohort.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tpl-title">Title</Label>
            <Input
              id="tpl-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Launch MVP"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-desc">Description</Label>
            <Textarea
              id="tpl-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder='What "done" looks like'
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-amount">Amount (GBP)</Label>
              <Input
                id="tpl-amount"
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-due">Due Date (optional)</Label>
              <Input
                id="tpl-due"
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="tpl-active" checked={formIsActive} onCheckedChange={setFormIsActive} />
            <Label htmlFor="tpl-active">Active (auto-assign to new startups)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsCreateOpen(false)
              setEditingTemplate(null)
              resetForm()
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : editingTemplate ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <Link href={`/admin/${cohortSlug}/funding`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Funding
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">Milestone Templates</h1>
            <p className="text-muted-foreground">Default milestones for {cohort.label}</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Templates table */}
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            Active templates are automatically assigned to new startups. Drag to reorder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates && templates.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={templates.map((t) => t._id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {templates.map((template) => (
                      <SortableTemplateRow
                        key={template._id}
                        template={template}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          ) : (
            <EmptyState
              noCard
              icon={<Target className="h-6 w-6" />}
              title="No milestone templates"
              description="Create templates that will be automatically assigned to new startups."
              action={
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      {templateFormDialog}
    </div>
  )
}
