'use client'

import { useMemo, useState } from 'react'
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
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Id, Doc } from '@/convex/_generated/dataModel'

type Milestone = Doc<'milestones'>
type MilestoneFilter = 'all' | 'waiting' | 'submitted' | 'approved'

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

function StaticRow({
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
  return (
    <TableRow>
      <TableCell className="w-12" />
      <TableCell className="font-medium">{milestone.title}</TableCell>
      <TableCell className="max-w-[250px] text-sm text-muted-foreground">
        <div className="truncate">{milestone.description}</div>
        {(milestone.status === 'submitted' || milestone.status === 'approved') &&
          (milestone.planLink || milestone.planStorageId) && (
            <div className="mt-1 flex items-center gap-3">
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
      <TableCell className="text-right">£{milestone.amount.toLocaleString('en-GB')}</TableCell>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<MilestoneFilter>('all')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const milestoneList = useMemo(() => milestones ?? [], [milestones])
  const potential = milestoneList.reduce((sum, m) => sum + m.amount, 0)
  const unlocked = milestoneList
    .filter((m) => m.status === 'approved')
    .reduce((sum, m) => sum + m.amount, 0)
  const deployed = startup?.fundingDeployed ?? 0
  const available = Math.max(0, unlocked - deployed)
  const cappedDeployed = Math.max(0, Math.min(deployed, unlocked))
  const unlockedPct = potential > 0 ? (unlocked / potential) * 100 : 0
  const deployedPct = potential > 0 ? (cappedDeployed / potential) * 100 : 0
  const approvedCount = milestoneList.filter((m) => m.status === 'approved').length

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredMilestones = useMemo(() => {
    return milestoneList.filter((milestone) => {
      const matchesStatus = statusFilter === 'all' || milestone.status === statusFilter
      const matchesSearch =
        normalizedQuery.length === 0 ||
        milestone.title.toLowerCase().includes(normalizedQuery) ||
        milestone.description.toLowerCase().includes(normalizedQuery)
      return matchesStatus && matchesSearch
    })
  }, [milestoneList, normalizedQuery, statusFilter])
  const filtersActive = statusFilter !== 'all' || normalizedQuery.length > 0

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
      logClientError('Failed to save milestone:', error)
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
      logClientError('Failed to delete milestone:', error)
      toast.error('Failed to delete milestone')
    }
  }

  async function handleApprove(id: Id<'milestones'>) {
    try {
      await approveMilestone({ id })
      toast.success('Milestone approved')
    } catch (error) {
      logClientError('Failed to approve milestone:', error)
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
      logClientError('Failed to reorder:', error)
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
      logClientError('Failed to update deployed:', error)
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
            <h1 className="text-3xl font-bold tracking-tight font-display">{startup.name}</h1>
            <p className="text-muted-foreground">Milestone-based funding</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Milestone
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Funding utilization</p>
            <p className="text-xs text-muted-foreground">
              Deployed £{deployed.toLocaleString('en-GB')} of £{unlocked.toLocaleString('en-GB')}{' '}
              unlocked
            </p>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500/25"
              style={{ width: `${unlockedPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-blue-600"
              style={{ width: `${deployedPct}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              Deployed £{deployed.toLocaleString('en-GB')}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500/40" />
              Available £{available.toLocaleString('en-GB')}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Unlocked</p>
            <p className="mt-1 text-2xl font-bold font-display">
              £{unlocked.toLocaleString('en-GB')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Deployed</p>
            {deployedInput !== null ? (
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  value={deployedInput}
                  onChange={(e) => setDeployedInput(e.target.value)}
                  className="h-8 w-32"
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
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
                className="mt-1 cursor-pointer text-2xl font-bold font-display text-blue-600 hover:underline"
                onClick={() => setDeployedInput(String(deployed))}
                title="Click to edit"
              >
                £{deployed.toLocaleString('en-GB')}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Click amount to edit deployed funds
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Available</p>
            <p className="mt-1 text-2xl font-bold font-display text-green-600">
              £{available.toLocaleString('en-GB')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Potential (Admin)</p>
            <p className="mt-1 text-2xl font-bold font-display">
              £{potential.toLocaleString('en-GB')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {approvedCount} of {milestoneList.length} milestones approved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Milestones table */}
      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>Milestones</CardTitle>
          <CardDescription>
            {filtersActive
              ? 'Filtered view. Clear filters to drag and reorder milestones.'
              : 'Drag to reorder. Click approve to unlock funding.'}
          </CardDescription>
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search milestones"
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as MilestoneFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredMilestones.length > 0 ? (
            <>
              <div className="mb-3 text-sm text-muted-foreground">
                Showing {filteredMilestones.length} of {milestones?.length ?? 0} milestones
              </div>
              {filtersActive ? (
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
                    {filteredMilestones.map((milestone) => (
                      <StaticRow
                        key={milestone._id}
                        milestone={milestone}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        onApprove={handleApprove}
                      />
                    ))}
                  </TableBody>
                </Table>
              ) : (
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
                        items={filteredMilestones.map((m) => m._id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {filteredMilestones.map((milestone) => (
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
              )}
            </>
          ) : (
            <EmptyState
              noCard
              icon={filtersActive ? <Search className="h-6 w-6" /> : <Target className="h-6 w-6" />}
              title={filtersActive ? 'No milestones match your filters' : 'No milestones'}
              description={
                filtersActive
                  ? 'Try adjusting the search term or selected state.'
                  : 'Add milestones to track funding for this startup.'
              }
              action={
                !filtersActive ? (
                  <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Milestone
                  </Button>
                ) : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      {milestoneFormDialog}
    </div>
  )
}
