'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { logClientError } from '@/lib/logging'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Edit, Trash2, BookOpen, ExternalLink, Download, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'

type MediaType = 'video' | 'podcast' | 'book' | 'other_reading'

const mediaTypeLabels: Record<MediaType, string> = {
  video: 'Video',
  podcast: 'Podcast',
  book: 'Book',
  other_reading: 'Other Reading',
}

type ResourceWithEvent = {
  _id: Id<'resources'>
  _creationTime: number
  title: string
  category: MediaType
  topic?: string
  description?: string
  url?: string
  storageId?: Id<'_storage'>
  fileName?: string
  eventId?: Id<'cohortEvents'>
  isActive: boolean
  sortOrder: number
  eventTitle?: string
}

export default function AdminResourcesPage() {
  const resources = useQuery(api.resources.list) as ResourceWithEvent[] | undefined
  const allEvents = useQuery(api.cohortEvents.listAll)
  const topics = useQuery(api.resources.listTopics)

  const createResource = useMutation(api.resources.create)
  const updateResource = useMutation(api.resources.update)
  const removeResource = useMutation(api.resources.remove)
  const generateUploadUrl = useMutation(api.resources.generateUploadUrl)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingResource, setEditingResource] = useState<ResourceWithEvent | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('all')
  const [topicFilter, setTopicFilter] = useState<string>('all')

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formMediaType, setFormMediaType] = useState<MediaType>('video')
  const [formTopic, setFormTopic] = useState('')
  const [isNewTopic, setIsNewTopic] = useState(false)
  const [formDescription, setFormDescription] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formEventId, setFormEventId] = useState<string>('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [formFile, setFormFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Event cohort filter for event dropdown
  const [eventCohortFilter, setEventCohortFilter] = useState<string>('all')

  const filteredResources = useMemo(() => {
    if (!resources) return undefined
    const normalized = searchQuery.trim().toLowerCase()
    return resources.filter((r) => {
      const matchesMediaType = mediaTypeFilter === 'all' || r.category === mediaTypeFilter
      const matchesTopic =
        topicFilter === 'all' || (topicFilter === '__none__' ? !r.topic : r.topic === topicFilter)
      const matchesSearch =
        normalized.length === 0 ||
        r.title.toLowerCase().includes(normalized) ||
        (r.description || '').toLowerCase().includes(normalized) ||
        (r.eventTitle || '').toLowerCase().includes(normalized) ||
        (r.topic || '').toLowerCase().includes(normalized)
      return matchesMediaType && matchesTopic && matchesSearch
    })
  }, [resources, mediaTypeFilter, topicFilter, searchQuery])

  const filteredEvents = useMemo(() => {
    if (!allEvents) return []
    if (eventCohortFilter === 'all') return allEvents
    return allEvents.filter((e) => e.cohortName === eventCohortFilter)
  }, [allEvents, eventCohortFilter])

  const cohortNames = useMemo(() => {
    if (!allEvents) return []
    return [...new Set(allEvents.map((e) => e.cohortName))]
  }, [allEvents])

  const isLoading = resources === undefined

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

  function resetForm() {
    setFormTitle('')
    setFormMediaType('video')
    setFormTopic('')
    setIsNewTopic(false)
    setFormDescription('')
    setFormUrl('')
    setFormEventId('')
    setFormIsActive(true)
    setFormFile(null)
    setEventCohortFilter('all')
  }

  function openCreate() {
    resetForm()
    setIsCreateOpen(true)
  }

  function openEdit(resource: ResourceWithEvent) {
    setFormTitle(resource.title)
    setFormMediaType(resource.category)
    setFormTopic(resource.topic ?? '')
    setIsNewTopic(false)
    setFormDescription(resource.description ?? '')
    setFormUrl(resource.url ?? '')
    setFormEventId(resource.eventId ?? '')
    setFormIsActive(resource.isActive)
    setFormFile(null)
    setEditingResource(resource)
  }

  async function handleSave() {
    if (!formTitle) {
      toast.error('Please fill in the title')
      return
    }

    setIsSaving(true)
    try {
      let storageId: Id<'_storage'> | undefined
      let fileName: string | undefined

      // Upload file if selected
      if (formFile) {
        const uploadUrl = await generateUploadUrl()
        const result = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': formFile.type },
          body: formFile,
        })
        if (!result.ok) throw new Error('Failed to upload file')
        const { storageId: sid } = await result.json()
        storageId = sid
        fileName = formFile.name
      }

      if (editingResource) {
        await updateResource({
          id: editingResource._id,
          title: formTitle,
          category: formMediaType,
          topic: formTopic || undefined,
          clearTopic: !formTopic && !!editingResource.topic ? true : undefined,
          description: formDescription || undefined,
          url: formUrl || undefined,
          ...(storageId ? { storageId, fileName } : {}),
          eventId: formEventId ? (formEventId as Id<'cohortEvents'>) : undefined,
          clearEvent: !formEventId && !!editingResource.eventId ? true : undefined,
          isActive: formIsActive,
        })
        toast.success('Resource updated')
        setEditingResource(null)
      } else {
        await createResource({
          title: formTitle,
          category: formMediaType,
          topic: formTopic || undefined,
          description: formDescription || undefined,
          url: formUrl || undefined,
          storageId,
          fileName,
          eventId: formEventId ? (formEventId as Id<'cohortEvents'>) : undefined,
          isActive: formIsActive,
        })
        toast.success('Resource created')
        setIsCreateOpen(false)
      }
      resetForm()
    } catch (error) {
      logClientError('Failed to save resource:', error)
      toast.error('Failed to save resource')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: Id<'resources'>) {
    if (!confirm('Are you sure you want to delete this resource?')) return
    try {
      await removeResource({ id })
      toast.success('Resource deleted')
    } catch (error) {
      logClientError('Failed to delete resource:', error)
      toast.error('Failed to delete resource')
    }
  }

  const resourceFormDialog = (
    <Dialog
      open={isCreateOpen || !!editingResource}
      onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false)
          setEditingResource(null)
          resetForm()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingResource ? 'Edit Resource' : 'Add Resource'}</DialogTitle>
          <DialogDescription>
            {editingResource ? 'Update resource details.' : 'Add a new resource for founders.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 px-1 -mx-1 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="resource-title">Title</Label>
            <Input
              id="resource-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. How to Build a Startup"
            />
          </div>
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="resource-media-type">Media Type</Label>
              <Select value={formMediaType} onValueChange={(v) => setFormMediaType(v as MediaType)}>
                <SelectTrigger id="resource-media-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="podcast">Podcast</SelectItem>
                  <SelectItem value="book">Book</SelectItem>
                  <SelectItem value="other_reading">Other Reading</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={isNewTopic ? '__new__' : formTopic || 'none'}
                onValueChange={(v) => {
                  if (v === '__new__') {
                    setIsNewTopic(true)
                    setFormTopic('')
                  } else if (v === 'none') {
                    setIsNewTopic(false)
                    setFormTopic('')
                  } else {
                    setIsNewTopic(false)
                    setFormTopic(v)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {topics?.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">+ New category...</SelectItem>
                </SelectContent>
              </Select>
              {isNewTopic && (
                <Input
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  placeholder="e.g. Fundraising"
                  autoFocus
                />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="resource-desc">Description (optional)</Label>
            <Textarea
              id="resource-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Short description"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resource-url">URL (optional)</Label>
            <Input
              id="resource-url"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resource-file">File Upload (optional)</Label>
            <Input
              id="resource-file"
              type="file"
              onChange={(e) => setFormFile(e.target.files?.[0] ?? null)}
              className="cursor-pointer"
            />
            {formFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {formFile.name} ({(formFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
            {editingResource?.fileName && !formFile && (
              <p className="text-sm text-muted-foreground">
                Current file: {editingResource.fileName}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Link to Event (optional)</Label>
            {cohortNames.length > 1 && (
              <Select value={eventCohortFilter} onValueChange={setEventCohortFilter}>
                <SelectTrigger className="mb-2">
                  <SelectValue placeholder="Filter by cohort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cohorts</SelectItem>
                  {cohortNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={formEventId || 'none'}
              onValueChange={(v) => setFormEventId(v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No event linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No event linked</SelectItem>
                {filteredEvents.map((event) => (
                  <SelectItem key={event._id} value={event._id}>
                    {event.title} ({event.cohortName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="resource-active" checked={formIsActive} onCheckedChange={setFormIsActive} />
            <Label htmlFor="resource-active">Active (visible to founders)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsCreateOpen(false)
              setEditingResource(null)
              resetForm()
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : editingResource ? 'Save Changes' : 'Add Resource'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Resources</h1>
          <p className="text-muted-foreground">
            Curated library of videos, podcasts, books, and reading materials for founders
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Resource
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, description, or event"
            className="pl-9"
          />
        </div>
        <Select value={mediaTypeFilter} onValueChange={setMediaTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Media type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="podcast">Podcast</SelectItem>
            <SelectItem value="book">Book</SelectItem>
            <SelectItem value="other_reading">Other Reading</SelectItem>
          </SelectContent>
        </Select>
        <Select value={topicFilter} onValueChange={setTopicFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="__none__">Uncategorised</SelectItem>
            {topics?.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resources table */}
      <Card>
        <CardHeader>
          <CardTitle>Resources</CardTitle>
          <CardDescription>Manage resources available to all founders.</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredResources && filteredResources.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResources.map((resource) => (
                  <TableRow
                    key={resource._id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => openEdit(resource)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {resource.title}
                        {resource.url && (
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </a>
                        )}
                        {resource.storageId && (
                          <Download className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{mediaTypeLabels[resource.category]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {resource.topic ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {resource.eventTitle ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={resource.isActive ? 'success' : 'secondary'}>
                        {resource.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(resource)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(resource._id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              noCard
              icon={<BookOpen className="h-6 w-6" />}
              title="No resources yet"
              description="Add videos, podcasts, books, and reading materials for founders."
              action={
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Resource
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      {resourceFormDialog}
    </div>
  )
}
