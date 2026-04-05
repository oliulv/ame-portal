'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { logClientError } from '@/lib/logging'
import { useParams, useRouter } from 'next/navigation'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Target,
  Search,
  ListChecks,
  LayoutGrid,
  List,
  Check,
  ChevronsUpDown,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Id, Doc } from '@/convex/_generated/dataModel'

type MilestoneWithStartup = Doc<'milestones'> & {
  startupName: string
  startupSlug: string | undefined
}
type MilestoneTemplate = Doc<'milestoneTemplates'>
type MilestoneFilter = 'all' | 'waiting' | 'submitted' | 'approved' | 'changes_requested'
type ViewTab = 'milestones' | 'templates'
type MilestoneViewMode = 'list' | 'wave'

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-500',
  submitted: 'bg-amber-500',
  changes_requested: 'bg-orange-500',
  waiting: 'bg-gray-300',
}

// --- Wave Reorder DnD row ---
function SortableWaveMilestoneRow({
  milestone,
  cohortSlug,
}: {
  milestone: MilestoneWithStartup
  cohortSlug: string
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
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 border rounded px-3 py-2 bg-background"
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${milestone.title}`}
        className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded shrink-0"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div
        className={`h-5 w-5 rounded shrink-0 ${STATUS_COLORS[milestone.status] || 'bg-gray-200'}`}
      />
      <Link
        href={`/admin/${cohortSlug}/milestones/${milestone._id}`}
        className="text-sm font-medium truncate hover:underline"
      >
        {milestone.title}
      </Link>
      <Badge variant="secondary" className="ml-auto shrink-0 text-xs">
        {milestone.status === 'changes_requested' ? 'changes requested' : milestone.status}
      </Badge>
    </div>
  )
}

// --- Wave Reorder Dialog ---
function WaveReorderDialog({
  startupId,
  startupName,
  milestones,
  onClose,
  onReorder,
  cohortSlug,
}: {
  startupId: string
  startupName: string
  milestones: MilestoneWithStartup[]
  onClose: () => void
  onReorder: (ids: Id<'milestones'>[]) => Promise<void>
  cohortSlug: string
}) {
  const [items, setItems] = useState(milestones)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((prev) => {
      const oldIndex = prev.findIndex((m) => m._id === active.id)
      const newIndex = prev.findIndex((m) => m._id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reorder Custom Milestones</DialogTitle>
          <DialogDescription>
            Drag to reorder {startupName}&apos;s custom milestones in the wave view.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items.map((m) => m._id)} strategy={verticalListSortingStrategy}>
              {items.map((m) => (
                <SortableWaveMilestoneRow key={m._id} milestone={m} cohortSlug={cohortSlug} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await onReorder(items.map((m) => m._id))
              onClose()
            }}
          >
            Save Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Template DnD row ---
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

export default function MilestonesAggregatePage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const allMilestones = useQuery(
    api.milestones.listByCohort,
    cohort ? { cohortId: cohort._id } : 'skip'
  )
  const templates = useQuery(
    api.milestoneTemplates.list,
    cohort?._id ? { cohortId: cohort._id } : 'skip'
  )
  const startups = useQuery(api.startups.list, cohort ? { cohortId: cohort._id } : 'skip')

  // Template mutations
  const updateTemplate = useMutation(api.milestoneTemplates.update)
  const removeTemplate = useMutation(api.milestoneTemplates.remove)
  const reorderTemplates = useMutation(api.milestoneTemplates.reorder)

  // Milestone mutations
  const approveMilestone = useMutation(api.milestones.approve)
  const reorderMilestones = useMutation(api.milestones.reorder)

  const [activeTab, setActiveTab] = useState<ViewTab>('milestones')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<MilestoneFilter>('all')
  const [startupFilter, setStartupFilter] = useState<string>('all')
  const [startupFilterOpen, setStartupFilterOpen] = useState(false)
  const [viewMode, setViewMode] = useState<MilestoneViewMode>('list')
  const [waveReorderStartupId, setWaveReorderStartupId] = useState<string | null>(null)

  // Template form state
  const [editingTemplate, setEditingTemplate] = useState<MilestoneTemplate | null>(null)
  const [tplFormTitle, setTplFormTitle] = useState('')
  const [tplFormDescription, setTplFormDescription] = useState('')
  const [tplFormAmount, setTplFormAmount] = useState('')
  const [tplFormDueDate, setTplFormDueDate] = useState('')
  const [tplFormIsActive, setTplFormIsActive] = useState(true)
  const [tplFormRequireLink, setTplFormRequireLink] = useState(true)
  const [tplFormRequireFile, setTplFormRequireFile] = useState(true)
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredMilestones = useMemo(() => {
    if (!allMilestones) return []
    return allMilestones.filter((m) => {
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter
      const matchesStartup = startupFilter === 'all' || (m.startupSlug ?? '') === startupFilter
      const matchesSearch =
        normalizedQuery.length === 0 ||
        m.title.toLowerCase().includes(normalizedQuery) ||
        m.startupName.toLowerCase().includes(normalizedQuery)
      return matchesStatus && matchesStartup && matchesSearch
    })
  }, [allMilestones, statusFilter, startupFilter, normalizedQuery])

  const milestoneStats = useMemo(() => {
    if (!allMilestones) return { total: 0, approved: 0, submitted: 0, waiting: 0 }
    return {
      total: allMilestones.length,
      approved: allMilestones.filter((m) => m.status === 'approved').length,
      submitted: allMilestones.filter((m) => m.status === 'submitted').length,
      waiting: allMilestones.filter(
        (m) => m.status === 'waiting' || m.status === 'changes_requested'
      ).length,
    }
  }, [allMilestones])

  // Determine if DnD should be enabled (only when filtered to a single startup, no other filters)
  const singleStartupForDnd =
    startupFilter !== 'all' && statusFilter === 'all' && normalizedQuery.length === 0
      ? startupFilter
      : null

  // Wave view data: group milestones by template + align customs by position
  const waveData = useMemo(() => {
    if (!allMilestones || !templates || !startups) return null

    const startupList = startups.filter((s) => s.excludeFromMetrics !== true)
    const templateGroups = templates.map((tpl) => {
      const milestones = allMilestones.filter((m) => m.milestoneTemplateId === tpl._id)
      return { template: tpl, milestones }
    })

    // Group custom milestones by startup, sorted by sortOrder desc (same as list view)
    const customByStartup = new Map<string, MilestoneWithStartup[]>()
    for (const m of allMilestones) {
      if (m.milestoneTemplateId) continue
      const list = customByStartup.get(m.startupId) ?? []
      list.push(m)
      customByStartup.set(m.startupId, list)
    }
    // Sort each startup's customs by sortOrder desc
    for (const [, list] of customByStartup) {
      list.sort((a, b) => b.sortOrder - a.sortOrder)
    }

    // Find max number of custom milestones any startup has
    let maxCustom = 0
    for (const [, list] of customByStartup) {
      maxCustom = Math.max(maxCustom, list.length)
    }

    return { startupList, templateGroups, customByStartup, maxCustom }
  }, [allMilestones, templates, startups])

  const isLoading =
    cohort === undefined ||
    allMilestones === undefined ||
    templates === undefined ||
    startups === undefined

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
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

  if (!cohort) {
    return (
      <EmptyState
        icon={<Target className="h-6 w-6" />}
        title="Cohort not found"
        description="The selected cohort could not be found."
      />
    )
  }

  // --- Template handlers ---
  function resetTemplateForm() {
    setTplFormTitle('')
    setTplFormDescription('')
    setTplFormAmount('')
    setTplFormDueDate('')
    setTplFormIsActive(true)
    setTplFormRequireLink(true)
    setTplFormRequireFile(true)
  }

  function openEditTemplate(template: MilestoneTemplate) {
    setTplFormTitle(template.title)
    setTplFormDescription(template.description)
    setTplFormAmount(String(template.amount))
    setTplFormDueDate(template.dueDate ?? '')
    setTplFormIsActive(template.isActive)
    setTplFormRequireLink(template.requireLink !== false)
    setTplFormRequireFile(template.requireFile !== false)
    setEditingTemplate(template)
  }

  async function handleSaveTemplate() {
    if (!editingTemplate) return
    const amount = parseFloat(tplFormAmount)
    if (!tplFormTitle || !tplFormDescription || isNaN(amount)) {
      toast.error('Please fill in all required fields')
      return
    }
    setIsSavingTemplate(true)
    try {
      await updateTemplate({
        id: editingTemplate._id,
        title: tplFormTitle,
        description: tplFormDescription,
        amount,
        dueDate: tplFormDueDate || undefined,
        isActive: tplFormIsActive,
        requireLink: tplFormRequireLink,
        requireFile: tplFormRequireFile,
      })
      toast.success('Template updated')
      setEditingTemplate(null)
      resetTemplateForm()
    } catch (error) {
      logClientError('Failed to save template:', error)
      toast.error('Failed to save template')
    } finally {
      setIsSavingTemplate(false)
    }
  }

  async function handleDeleteTemplate(id: Id<'milestoneTemplates'>) {
    if (!confirm('Are you sure you want to delete this template?')) return
    try {
      await removeTemplate({ id })
      toast.success('Template deleted')
    } catch (error) {
      logClientError('Failed to delete template:', error)
      toast.error('Failed to delete template')
    }
  }

  async function handleTemplateDragEnd(event: DragEndEvent) {
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

  // --- Milestone handlers ---
  async function handleApprove(id: Id<'milestones'>) {
    try {
      await approveMilestone({ id })
      toast.success('Milestone approved')
    } catch (error) {
      logClientError('Failed to approve milestone:', error)
      toast.error('Failed to approve milestone')
    }
  }

  async function handleMilestoneDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !singleStartupForDnd) return
    const startupMilestones = filteredMilestones
    const oldIndex = startupMilestones.findIndex((m) => m._id === active.id)
    const newIndex = startupMilestones.findIndex((m) => m._id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(startupMilestones, oldIndex, newIndex)
    try {
      await reorderMilestones({ milestoneIds: newOrder.map((m) => m._id) })
      toast.success('Milestones reordered')
    } catch (error) {
      logClientError('Failed to reorder:', error)
      toast.error('Failed to reorder milestones')
    }
  }

  function getStatusBadge(status: string) {
    return (
      <Badge
        variant={
          status === 'approved'
            ? 'success'
            : status === 'submitted' || status === 'changes_requested'
              ? 'warning'
              : 'secondary'
        }
      >
        {status === 'changes_requested' ? 'changes requested' : status}
      </Badge>
    )
  }

  function getWaveStatusIndicator(status: string, title?: string) {
    const statusLabel = status === 'changes_requested' ? 'changes requested' : status
    const tooltipText = title ? `${title} (${statusLabel})` : statusLabel
    return (
      <div
        className={`h-6 w-6 rounded ${STATUS_COLORS[status] || 'bg-gray-200'}`}
        title={tooltipText}
      />
    )
  }

  // --- Milestone table ---
  function renderMilestoneTable(items: MilestoneWithStartup[], enableDnd: boolean) {
    if (items.length === 0) {
      return (
        <EmptyState
          noCard
          icon={<Search className="h-6 w-6" />}
          title="No milestones match your filters"
          description="Try adjusting the search term or filters."
        />
      )
    }

    const tableContent = (
      <Table>
        <TableHeader>
          <TableRow>
            {enableDnd && <TableHead className="w-12"></TableHead>}
            <TableHead>Startup</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enableDnd ? (
            <SortableContext items={items.map((m) => m._id)} strategy={verticalListSortingStrategy}>
              {items.map((m) => (
                <SortableMilestoneRow
                  key={m._id}
                  milestone={m}
                  cohortSlug={cohortSlug}
                  onApprove={handleApprove}
                />
              ))}
            </SortableContext>
          ) : (
            items.map((m) => (
              <MilestoneRow
                key={m._id}
                milestone={m}
                cohortSlug={cohortSlug}
                onApprove={handleApprove}
              />
            ))
          )}
        </TableBody>
      </Table>
    )

    if (enableDnd) {
      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleMilestoneDragEnd}
        >
          {tableContent}
        </DndContext>
      )
    }
    return tableContent
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Milestones</h1>
          <p className="text-muted-foreground">All milestones and templates for {cohort.label}</p>
        </div>
        <Link href={`/admin/${cohortSlug}/milestones/new`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Milestone
          </Button>
        </Link>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab('milestones')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'milestones'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <ListChecks className="mr-2 h-4 w-4 inline" />
          Milestones
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === 'templates'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Target className="mr-2 h-4 w-4 inline" />
          Templates
          {templates && templates.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {templates.length}
            </Badge>
          )}
        </button>
      </div>

      {/* MILESTONES TAB */}
      {activeTab === 'milestones' && (
        <>
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="mt-1 text-2xl font-bold font-display">{milestoneStats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <p className="mt-1 text-2xl font-bold font-display text-green-600">
                  {milestoneStats.approved}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                <p className="mt-1 text-2xl font-bold font-display text-amber-600">
                  {milestoneStats.submitted}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Waiting</p>
                <p className="mt-1 text-2xl font-bold font-display">{milestoneStats.waiting}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters + view toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or startup"
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as MilestoneFilter)}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="changes_requested">Changes Requested</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={startupFilterOpen} onOpenChange={setStartupFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={startupFilterOpen}
                  className="w-[170px] justify-between font-normal"
                >
                  <span className="truncate">
                    {startupFilter === 'all'
                      ? 'All startups'
                      : (startups?.find((s) => (s.slug ?? s._id) === startupFilter)?.name ??
                        'All startups')}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <Command>
                  <CommandInput placeholder="Search startup..." />
                  <CommandList>
                    <CommandEmpty>No startup found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setStartupFilter('all')
                          setStartupFilterOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            startupFilter === 'all' ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        All startups
                      </CommandItem>
                      {startups?.map((s) => (
                        <CommandItem
                          key={s._id}
                          value={s.name}
                          onSelect={() => {
                            setStartupFilter(s.slug ?? s._id)
                            setStartupFilterOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              startupFilter === (s.slug ?? s._id) ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          {s.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="flex gap-1 border rounded-md p-0.5">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-7 w-7 p-0"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'wave' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('wave')}
                className="h-7 w-7 p-0"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* List view */}
          {viewMode === 'list' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {singleStartupForDnd
                    ? 'Drag to reorder milestones for this startup'
                    : `Showing ${filteredMilestones.length} of ${allMilestones?.length ?? 0} milestones`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderMilestoneTable(filteredMilestones, !!singleStartupForDnd)}
              </CardContent>
            </Card>
          )}

          {/* Wave view */}
          {viewMode === 'wave' && waveData && (
            <Card>
              <CardHeader>
                <CardTitle>Wave View</CardTitle>
                <CardDescription>
                  Milestones grouped by template. Each column is a startup.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {waveData.templateGroups.length === 0 && waveData.maxCustom === 0 ? (
                  <EmptyState
                    noCard
                    icon={<Target className="h-6 w-6" />}
                    title="No milestones"
                    description="Create milestones to see the wave view."
                  />
                ) : (
                  <div className="space-y-6">
                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-3 w-3 rounded bg-green-500" /> Approved
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-3 w-3 rounded bg-amber-500" /> Submitted
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-3 w-3 rounded bg-orange-500" /> Changes Requested
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-3 w-3 rounded bg-gray-300" /> Waiting
                      </span>
                    </div>

                    {/* Template rows */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 pr-4 font-medium text-muted-foreground min-w-[180px]">
                              Template
                            </th>
                            {waveData.startupList.map((s) => (
                              <th
                                key={s._id}
                                className="text-center py-2 px-2 font-medium text-muted-foreground"
                              >
                                <Link
                                  href={`/admin/${cohortSlug}/startups/${s.slug}`}
                                  className="hover:text-foreground hover:underline"
                                >
                                  {s.name}
                                </Link>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {waveData.templateGroups.map((group) => (
                            <tr key={group.template._id} className="border-b">
                              <td className="py-3 pr-4 font-medium">{group.template.title}</td>
                              {waveData.startupList.map((s) => {
                                const milestone = group.milestones.find(
                                  (m) => m.startupId === s._id
                                )
                                return (
                                  <td key={s._id} className="text-center py-3 px-2">
                                    {milestone ? (
                                      <Link
                                        href={`/admin/${cohortSlug}/milestones/${milestone._id}`}
                                        className="inline-block"
                                      >
                                        {getWaveStatusIndicator(milestone.status)}
                                      </Link>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                          {waveData.maxCustom > 0 && (
                            <tr className="border-b bg-muted/30">
                              <td className="py-2 px-4 text-xs font-medium text-muted-foreground">
                                Custom milestones
                              </td>
                              {waveData.startupList.map((s) => {
                                const customs = waveData.customByStartup.get(s._id)
                                return (
                                  <td key={s._id} className="text-center py-2 px-2">
                                    {customs && customs.length > 1 && (
                                      <button
                                        onClick={() => setWaveReorderStartupId(s._id)}
                                        aria-label={`Reorder ${s.name}'s custom milestones`}
                                        className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                                        title={`Reorder ${s.name}'s custom milestones`}
                                      >
                                        <GripVertical className="h-3 w-3 inline" />
                                      </button>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          )}
                          {Array.from({ length: waveData.maxCustom }, (_, posIndex) => (
                            <tr key={`custom-${posIndex}`} className="border-b">
                              <td className="py-3 pr-4 text-muted-foreground text-sm">
                                Custom {posIndex + 1}
                              </td>
                              {waveData.startupList.map((s) => {
                                const customs = waveData.customByStartup.get(s._id)
                                const milestone = customs?.[posIndex]
                                return (
                                  <td key={s._id} className="text-center py-3 px-2">
                                    {milestone ? (
                                      <Link
                                        href={`/admin/${cohortSlug}/milestones/${milestone._id}`}
                                        className="inline-block"
                                      >
                                        {getWaveStatusIndicator(milestone.status, milestone.title)}
                                      </Link>
                                    ) : null}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Wave Reorder Dialog */}
          {waveData && waveReorderStartupId && (
            <WaveReorderDialog
              startupId={waveReorderStartupId}
              startupName={
                waveData.startupList.find((s) => s._id === waveReorderStartupId)?.name ?? 'Startup'
              }
              milestones={waveData.customByStartup.get(waveReorderStartupId) ?? []}
              onClose={() => setWaveReorderStartupId(null)}
              onReorder={async (ids) => {
                try {
                  await reorderMilestones({ milestoneIds: ids })
                  toast.success('Custom milestones reordered')
                } catch (error) {
                  logClientError('Failed to reorder:', error)
                  toast.error('Failed to reorder milestones')
                }
              }}
              cohortSlug={cohortSlug}
            />
          )}
        </>
      )}

      {/* TEMPLATES TAB */}
      {activeTab === 'templates' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Templates</CardTitle>
                <CardDescription>
                  Active templates are automatically assigned to all startups in the cohort. Drag to
                  reorder.
                </CardDescription>
              </div>
              <Link href={`/admin/${cohortSlug}/milestones/new?template=true`}>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {templates && templates.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleTemplateDragEnd}
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
                          onEdit={openEditTemplate}
                          onDelete={handleDeleteTemplate}
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
                  <Link href={`/admin/${cohortSlug}/milestones/new?template=true`}>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Template
                    </Button>
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Template edit dialog */}
      <Dialog
        open={!!editingTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTemplate(null)
            resetTemplateForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Milestone Template</DialogTitle>
            <DialogDescription>
              Update template details. Submission requirement changes cascade to waiting milestones.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-title">Title</Label>
              <Input
                id="tpl-title"
                value={tplFormTitle}
                onChange={(e) => setTplFormTitle(e.target.value)}
                placeholder="e.g. Launch MVP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea
                id="tpl-desc"
                value={tplFormDescription}
                onChange={(e) => setTplFormDescription(e.target.value)}
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
                  value={tplFormAmount}
                  onChange={(e) => setTplFormAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-due">Due Date (optional)</Label>
                <Input
                  id="tpl-due"
                  type="date"
                  value={tplFormDueDate}
                  onChange={(e) => setTplFormDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="tpl-active"
                checked={tplFormIsActive}
                onCheckedChange={setTplFormIsActive}
              />
              <Label htmlFor="tpl-active">Active (auto-assign to all startups in cohort)</Label>
            </div>
            <div className="space-y-3">
              <Label>Submission requirements</Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="tpl-req-link"
                  checked={tplFormRequireLink}
                  onCheckedChange={setTplFormRequireLink}
                />
                <Label htmlFor="tpl-req-link" className="font-normal">
                  Accept link submission
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="tpl-req-file"
                  checked={tplFormRequireFile}
                  onCheckedChange={setTplFormRequireFile}
                />
                <Label htmlFor="tpl-req-file" className="font-normal">
                  Accept file upload
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingTemplate(null)
                resetTemplateForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSavingTemplate}>
              {isSavingTemplate ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- Reusable milestone row components ---

function MilestoneRow({
  milestone,
  cohortSlug,
  onApprove,
}: {
  milestone: MilestoneWithStartup
  cohortSlug: string
  onApprove: (id: Id<'milestones'>) => void
}) {
  const router = useRouter()
  return (
    <TableRow
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => router.push(`/admin/${cohortSlug}/milestones/${milestone._id}`)}
    >
      <TableCell
        className="font-medium"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <Link
          href={`/admin/${cohortSlug}/startups/${milestone.startupSlug}`}
          className="hover:underline"
        >
          {milestone.startupName}
        </Link>
      </TableCell>
      <TableCell className="font-medium">{milestone.title}</TableCell>
      <TableCell className="text-right">
        {'\u00A3'}
        {milestone.amount.toLocaleString('en-GB')}
      </TableCell>
      <TableCell>
        <Badge
          variant={
            milestone.status === 'approved'
              ? 'success'
              : milestone.status === 'submitted' || milestone.status === 'changes_requested'
                ? 'warning'
                : 'secondary'
          }
        >
          {milestone.status === 'changes_requested' ? 'changes requested' : milestone.status}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {milestone.dueDate
          ? new Date(milestone.dueDate).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : '-'}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
      </TableCell>
    </TableRow>
  )
}

function SortableMilestoneRow({
  milestone,
  cohortSlug,
  onApprove,
}: {
  milestone: MilestoneWithStartup
  cohortSlug: string
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
      <TableCell className="font-medium">
        <Link
          href={`/admin/${cohortSlug}/startups/${milestone.startupSlug}`}
          className="hover:underline"
        >
          {milestone.startupName}
        </Link>
      </TableCell>
      <TableCell>
        <Link
          href={`/admin/${cohortSlug}/milestones/${milestone._id}`}
          className="hover:underline font-medium"
        >
          {milestone.title}
        </Link>
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
              : milestone.status === 'submitted' || milestone.status === 'changes_requested'
                ? 'warning'
                : 'secondary'
          }
        >
          {milestone.status === 'changes_requested' ? 'changes requested' : milestone.status}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {milestone.dueDate
          ? new Date(milestone.dueDate).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : '-'}
      </TableCell>
      <TableCell className="text-right">
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
      </TableCell>
    </TableRow>
  )
}
