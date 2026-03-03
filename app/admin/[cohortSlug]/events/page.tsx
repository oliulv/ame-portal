'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { logClientError } from '@/lib/logging'
import { useParams } from 'next/navigation'
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
import { Plus, Edit, Trash2, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'

function extractLumaUrl(input: string): string | null {
  const trimmed = input.trim()
  // Direct URL
  if (trimmed.startsWith('https://') && (trimmed.includes('lu.ma') || trimmed.includes('luma.com')))
    return trimmed
  // Extract href from checkout button anchor tag
  const hrefMatch = trimmed.match(/href="(https?:\/\/(?:lu\.ma|luma\.com)[^"]+)"/)
  if (hrefMatch) return hrefMatch[1]
  // Backwards compat: extract src from iframe
  const srcMatch = trimmed.match(/src="(https?:\/\/(?:lu\.ma|luma\.com)[^"]+)"/)
  if (srcMatch) return srcMatch[1]
  return null
}

type CohortEvent = {
  _id: Id<'cohortEvents'>
  _creationTime: number
  cohortId: Id<'cohorts'>
  title: string
  description?: string
  date: string
  lumaEmbedUrl: string
  sortOrder: number
  isActive: boolean
}

export default function AdminEventsPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const events = useQuery(
    api.cohortEvents.list,
    cohort?._id ? { cohortId: cohort._id } : 'skip'
  ) as CohortEvent[] | undefined

  const createEvent = useMutation(api.cohortEvents.create)
  const updateEvent = useMutation(api.cohortEvents.update)
  const removeEvent = useMutation(api.cohortEvents.remove)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CohortEvent | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formEmbedCode, setFormEmbedCode] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const isLoading = cohort === undefined || events === undefined

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
    setFormDate('')
    setFormDescription('')
    setFormEmbedCode('')
    setFormIsActive(true)
  }

  function openCreate() {
    resetForm()
    setIsCreateOpen(true)
  }

  function openEdit(event: CohortEvent) {
    setFormTitle(event.title)
    setFormDate(event.date.slice(0, 10))
    setFormDescription(event.description ?? '')
    setFormEmbedCode(event.lumaEmbedUrl)
    setFormIsActive(event.isActive)
    setEditingEvent(event)
  }

  async function handleSave() {
    if (!formTitle || !formDate) {
      toast.error('Please fill in title and date')
      return
    }

    const lumaUrl = extractLumaUrl(formEmbedCode)
    if (!lumaUrl) {
      toast.error('Please provide a valid Luma event URL or checkout button code')
      return
    }

    setIsSaving(true)
    try {
      if (editingEvent) {
        await updateEvent({
          id: editingEvent._id,
          title: formTitle,
          description: formDescription || undefined,
          date: new Date(formDate).toISOString(),
          lumaEmbedUrl: lumaUrl,
          isActive: formIsActive,
        })
        toast.success('Event updated')
        setEditingEvent(null)
      } else {
        await createEvent({
          cohortId: cohort!._id,
          title: formTitle,
          description: formDescription || undefined,
          date: new Date(formDate).toISOString(),
          lumaEmbedUrl: lumaUrl,
        })
        toast.success('Event created')
        setIsCreateOpen(false)
      }
      resetForm()
    } catch (error) {
      logClientError('Failed to save event:', error)
      toast.error('Failed to save event')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: Id<'cohortEvents'>) {
    if (!confirm('Are you sure you want to delete this event?')) return
    try {
      await removeEvent({ id })
      toast.success('Event deleted')
    } catch (error) {
      logClientError('Failed to delete event:', error)
      toast.error('Failed to delete event')
    }
  }

  const eventFormDialog = (
    <Dialog
      open={isCreateOpen || !!editingEvent}
      onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false)
          setEditingEvent(null)
          resetForm()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingEvent ? 'Edit Event' : 'Add Event'}</DialogTitle>
          <DialogDescription>
            {editingEvent
              ? 'Update event details.'
              : 'Add a new event with a Luma registration link for founders.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Demo Day Prep Workshop"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-date">Date</Label>
            <Input
              id="event-date"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-desc">Description (optional)</Label>
            <Textarea
              id="event-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Brief description of the event"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-embed">Luma Checkout Button Code</Label>
            <Textarea
              id="event-embed"
              className="font-mono text-xs bg-muted"
              value={formEmbedCode}
              onChange={(e) => setFormEmbedCode(e.target.value)}
              placeholder={
                '<a href="https://lu.ma/event/evt-..." class="luma-checkout--button" ...>'
              }
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Paste the Luma checkout button snippet from your event page. A plain URL also works.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="event-active" checked={formIsActive} onCheckedChange={setFormIsActive} />
            <Label htmlFor="event-active">Active (visible to founders)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsCreateOpen(false)
              setEditingEvent(null)
              resetForm()
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : editingEvent ? 'Save Changes' : 'Add Event'}
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
          <h1 className="text-3xl font-bold tracking-tight font-display">Events</h1>
          <p className="text-muted-foreground">Manage events and calendar for this cohort</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Event
        </Button>
      </div>

      {/* Events table */}
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>Events visible to founders in this cohort.</CardDescription>
        </CardHeader>
        <CardContent>
          {events && events.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event._id}>
                    <TableCell className="font-medium">{event.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(event.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={event.isActive ? 'success' : 'secondary'}>
                        {event.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(event)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(event._id)}>
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
              icon={<Calendar className="h-6 w-6" />}
              title="No events yet"
              description="Add events that founders can see on their calendar."
              action={
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Event
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      {eventFormDialog}
    </div>
  )
}
