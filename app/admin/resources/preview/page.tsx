'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { logClientError } from '@/lib/logging'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, GripVertical, ExternalLink, Download, Save } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'
import {
  closestCenter,
  DndContext,
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

type MediaType = 'video' | 'podcast' | 'book' | 'other_reading'

type ResourceItem = {
  _id: Id<'resources'>
  title: string
  category: MediaType
  topic?: string
  url?: string
  storageId?: Id<'_storage'>
  isActive: boolean
  eventTitle?: string
  sortOrder: number
}

const sectionOrder: { category: MediaType; title: string }[] = [
  { category: 'video', title: 'Video' },
  { category: 'other_reading', title: 'Other Reading & Materials' },
  { category: 'book', title: 'Books' },
  { category: 'podcast', title: 'Podcasts' },
]

function SortableItem({ resource }: { resource: ResourceItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: resource._id,
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
      className="flex items-center gap-3 py-3 border-b last:border-b-0"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{resource.title}</p>
          {resource.url && <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />}
          {resource.storageId && <Download className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </div>
        {resource.eventTitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{resource.eventTitle}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {resource.topic && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 font-normal whitespace-nowrap"
          >
            {resource.topic}
          </Badge>
        )}
        {!resource.isActive && <Badge variant="secondary">Inactive</Badge>}
      </div>
    </div>
  )
}

export default function AdminResourcesPreviewPage() {
  const resources = useQuery(api.resources.list) as ResourceItem[] | undefined
  const reorderResources = useMutation(api.resources.reorder)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Local order state: map of category -> resource IDs in order
  const [localOrder, setLocalOrder] = useState<Record<MediaType, string[]> | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Build a lookup map from resources
  const resourceMap = useMemo(() => {
    if (!resources) return new Map<string, ResourceItem>()
    return new Map(resources.map((r) => [r._id, r]))
  }, [resources])

  // Initialize local order when resources load
  useEffect(() => {
    if (resources && !localOrder) {
      const order: Record<MediaType, string[]> = {
        video: [],
        other_reading: [],
        book: [],
        podcast: [],
      }
      for (const r of resources) {
        order[r.category].push(r._id)
      }
      setLocalOrder(order)
    }
  }, [resources, localOrder])

  function handleDragEnd(category: MediaType) {
    return (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !localOrder) return

      const ids = localOrder[category]
      const oldIndex = ids.indexOf(active.id as string)
      const newIndex = ids.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return

      setLocalOrder({ ...localOrder, [category]: arrayMove(ids, oldIndex, newIndex) })
      setHasChanges(true)
    }
  }

  async function handleSave() {
    if (!localOrder) return
    setIsSaving(true)
    try {
      const allIds = [
        ...localOrder.video,
        ...localOrder.other_reading,
        ...localOrder.book,
        ...localOrder.podcast,
      ] as Id<'resources'>[]
      await reorderResources({ orderedIds: allIds })
      setHasChanges(false)
      toast.success('Order saved')
    } catch (error) {
      logClientError('Failed to save order:', error)
      toast.error('Failed to save order')
    } finally {
      setIsSaving(false)
    }
  }

  if (!resources || !localOrder) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div>
            <Link href="/admin/resources">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Resources
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Preview & Reorder</h1>
          <p className="text-muted-foreground">
            Drag items to reorder how founders see resources. Save when done.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Order'}
        </Button>
      </div>

      {/* Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {sectionOrder.map(({ category, title }) => {
          const ids = localOrder[category]
          const items = ids.map((id) => resourceMap.get(id)).filter(Boolean) as ResourceItem[]

          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                {items.length > 0 ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd(category)}
                  >
                    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                      {items.map((r) => (
                        <SortableItem key={r._id} resource={r} />
                      ))}
                    </SortableContext>
                  </DndContext>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    No resources in this section.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
