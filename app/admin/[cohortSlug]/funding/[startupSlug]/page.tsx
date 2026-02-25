'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Check,
  GripVertical,
  Target,
  ExternalLink,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Id, Doc } from '@/convex/_generated/dataModel'

type Milestone = Doc<'milestones'>

function PlanFileLink({ storageId, fileName }: { storageId: Id<'_storage'>; fileName?: string }) {
  const fileUrl = useQuery(api.milestones.getFileUrl, { storageId })
  if (!fileUrl) return <span className="text-xs text-muted-foreground">Loading file...</span>
  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <FileText className="h-3 w-3" />
      {fileName || 'View Plan'}
    </a>
  )
}

function SortableRow({
  milestone,
  onEdit,
  onDelete,
  onApprove,
}: {
  milestone: Milestone
  onEdit: (m: Milestone) => void
  onDelete: (id: Id<'milestones'>) => void
  onApprove: (id: Id<'milestones'>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: milestone._id,
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
      <TableCell className="font-medium">{milestone.title}</TableCell>
      <TableCell className="max-w-[250px] text-sm text-muted-foreground">
        <div className="truncate">{milestone.description}</div>
        {(milestone.status === 'submitted' || milestone.status === 'approved') &&
          (milestone.planLink || milestone.planStorageId) && (
            <div className="flex items-center gap-3 mt-1">
              {milestone.planLink && (
                <a
                  href={milestone.planLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Plan Link
                </a>
              )}
              {milestone.planStorageId && (
                <PlanFileLink
                  storageId={milestone.planStorageId}
                  fileName={milestone.planFileName}
                />
              )}
            </div>
          )}
      </TableCell>
      <TableCell className="text-right">
        {'\u00A3'}
        {milestone.amount.toLocaleString('en-GB')}
      </TableCell>
      <TableCell>
        <Badge
          variant={
            milestone.status === 'approved'
              ? 'success'
              : milestone.status === 'submitted'
                ? 'warning'
                : 'secondary'
          }
        >
          {milestone.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {milestone.status === 'submitted' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onApprove(milestone._id)}
              title="Approve"
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onEdit(milestone)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(milestone._id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function StartupFundingPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const startupSlug = params.startupSlug as string

  const startup = useQuery(api.startups.getBySlug, { slug: startupSlug })
  const milestones = useQuery(
    api.milestones.listByStartup,
    startup ? { startupId: startup._id } : 'skip'
  )

  const createMilestone = useMutation(api.milestones.create)
  const updateMilestone = useMutation(api.milestones.update)
  const removeMilestone = useMutation(api.milestones.remove)
  const approveMilestone = useMutation(api.milestones.approve)
  const reorderMilestones = useMutation(api.milestones.reorder)
  const updateFundingDeployed = useMutation(api.milestones.updateFundingDeployed)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)
  const [deployedInput, setDeployedInput] = useState<string | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formStatus, setFormStatus] = useState<'waiting' | 'submitted' | 'approved'>('waiting')
  const [formDueDate, setFormDueDate] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const isLoading = startup === undefined || milestones === undefined

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!startup) {
    return (
      <EmptyState
        icon={<Target className="h-6 w-6" />}
        title="Startup not found"
        description="The selected startup could not be found."
      />
    )
  }

  const potential = milestones?.reduce((sum, m) => sum + m.amount, 0) ?? 0
  const unlocked =
    milestones?.filter((m) => m.status === 'approved').reduce((sum, m) => sum + m.amount, 0) ?? 0
  const deployed = startup.fundingDeployed ?? 0

  function resetForm() {
    setFormTitle('')
    setFormDescription('')
    setFormAmount('')
    setFormStatus('waiting')
    setFormDueDate('')
  }

  function openCreate() {
    resetForm()
    setIsCreateOpen(true)
  }

  function openEdit(milestone: Milestone) {
    setFormTitle(milestone.title)
    setFormDescription(milestone.description)
    setFormAmount(String(milestone.amount))
    setFormStatus(milestone.status)
    setFormDueDate(milestone.dueDate ?? '')
    setEditingMilestone(milestone)
  }

  async function handleSave() {
    const amount = parseFloat(formAmount)
    if (!formTitle || !formDescription || isNaN(amount)) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSaving(true)
    try {
      if (editingMilestone) {
        await updateMilestone({
          id: editingMilestone._id,
          title: formTitle,
          description: formDescription,
          amount,
          status: formStatus,
          dueDate: formDueDate || undefined,
        })
        toast.success('Milestone updated')
        setEditingMilestone(null)
      } else {
        await createMilestone({
          startupId: startup!._id,
          title: formTitle,
          description: formDescription,
          amount,
          status: formStatus,
          dueDate: formDueDate || undefined,
        })
        toast.success('Milestone created')
        setIsCreateOpen(false)
      }
      resetForm()
    } catch (error) {
      console.error('Failed to save milestone:', error)
      toast.error('Failed to save milestone')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: Id<'milestones'>) {
    if (!confirm('Are you sure you want to delete this milestone?')) return
    try {
      await removeMilestone({ id })
      toast.success('Milestone deleted')
    } catch (error) {
      console.error('Failed to delete milestone:', error)
      toast.error('Failed to delete milestone')
    }
  }

  async function handleApprove(id: Id<'milestones'>) {
    try {
      await approveMilestone({ id })
      toast.success('Milestone approved')
    } catch (error) {
      console.error('Failed to approve milestone:', error)
      toast.error('Failed to approve milestone')
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !milestones) return

    const oldIndex = milestones.findIndex((m) => m._id === active.id)
    const newIndex = milestones.findIndex((m) => m._id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = arrayMove(milestones, oldIndex, newIndex)
    try {
      await reorderMilestones({ milestoneIds: newOrder.map((m) => m._id) })
      toast.success('Milestones reordered')
    } catch (error) {
      console.error('Failed to reorder:', error)
      toast.error('Failed to reorder milestones')
    }
  }

  async function handleDeployedSave() {
    if (deployedInput === null) return
    const amount = parseFloat(deployedInput)
    if (isNaN(amount)) {
      toast.error('Invalid amount')
      return
    }
    try {
      await updateFundingDeployed({ startupId: startup!._id, amount })
      toast.success('Deployed amount updated')
      setDeployedInput(null)
    } catch (error) {
      console.error('Failed to update deployed:', error)
      toast.error('Failed to update deployed amount')
    }
  }

  const milestoneFormDialog = (
    <Dialog
      open={isCreateOpen || !!editingMilestone}
      onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false)
          setEditingMilestone(null)
          resetForm()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingMilestone ? 'Edit Milestone' : 'Create Milestone'}</DialogTitle>
          <DialogDescription>
            {editingMilestone
              ? 'Update milestone details.'
              : 'Add a new milestone for this startup.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="ms-title">Title</Label>
            <Input
              id="ms-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Launch MVP"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ms-desc">Description</Label>
            <Textarea
              id="ms-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder='What "done" looks like'
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ms-amount">Amount (GBP)</Label>
              <Input
                id="ms-amount"
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ms-status">Status</Label>
              <Select
                value={formStatus}
                onValueChange={(v) => setFormStatus(v as typeof formStatus)}
              >
                <SelectTrigger id="ms-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ms-due">Due Date (optional)</Label>
            <Input
              id="ms-due"
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsCreateOpen(false)
              setEditingMilestone(null)
              resetForm()
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : editingMilestone ? 'Save Changes' : 'Create'}
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
            <h1 className="text-3xl font-bold tracking-tight">{startup.name}</h1>
            <p className="text-muted-foreground">Milestone-based funding</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Milestone
          </Button>
        </div>
      </div>

      {/* Funding summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Potential</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {'\u00A3'}
              {potential.toLocaleString('en-GB')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unlocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {'\u00A3'}
              {unlocked.toLocaleString('en-GB')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Deployed</CardTitle>
          </CardHeader>
          <CardContent>
            {deployedInput !== null ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={deployedInput}
                  onChange={(e) => setDeployedInput(e.target.value)}
                  className="h-8 w-32"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDeployedSave()
                    if (e.key === 'Escape') setDeployedInput(null)
                  }}
                />
                <Button size="sm" variant="ghost" onClick={handleDeployedSave}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="text-2xl font-bold text-blue-600 cursor-pointer hover:underline"
                onClick={() => setDeployedInput(String(deployed))}
                title="Click to edit"
              >
                {'\u00A3'}
                {deployed.toLocaleString('en-GB')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Milestones table */}
      <Card>
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
          <CardDescription>Drag to reorder. Click approve to unlock funding.</CardDescription>
        </CardHeader>
        <CardContent>
          {milestones && milestones.length > 0 ? (
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
                    items={milestones.map((m) => m._id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {milestones.map((milestone) => (
                      <SortableRow
                        key={milestone._id}
                        milestone={milestone}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        onApprove={handleApprove}
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
              title="No milestones"
              description="Add milestones to track funding for this startup."
              action={
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Milestone
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      {milestoneFormDialog}
    </div>
  )
}
