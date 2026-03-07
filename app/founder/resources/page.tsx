'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { logClientError } from '@/lib/logging'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Download, Search, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'

type MediaType = 'video' | 'podcast' | 'book' | 'other_reading'

const mediaTypeLabels: Record<MediaType, string> = {
  video: 'Video',
  podcast: 'Podcast',
  book: 'Book',
  other_reading: 'Other Reading',
}

type ResourceItem = {
  _id: Id<'resources'>
  title: string
  category: MediaType
  topic?: string
  description?: string
  url?: string
  storageId?: Id<'_storage'>
  fileName?: string
  eventTitle?: string
}

function ResourceEntry({ resource }: { resource: ResourceItem }) {
  const fileUrl = useQuery(
    api.resources.getFileUrl,
    resource.storageId ? { storageId: resource.storageId } : 'skip'
  )
  const href = resource.url || fileUrl || undefined

  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{resource.title}</p>
          {resource.url && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          {resource.storageId && (
            <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
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
      </div>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start justify-between gap-3 py-3 -mx-2 px-2 rounded-md transition-colors cursor-pointer hover:bg-muted/50"
      >
        {inner}
      </a>
    )
  }

  return <div className="flex items-start justify-between gap-3 py-3">{inner}</div>
}

const sections: { category: MediaType; title: string }[] = [
  { category: 'video', title: 'Video' },
  { category: 'other_reading', title: 'Other Reading & Materials' },
  { category: 'book', title: 'Books' },
  { category: 'podcast', title: 'Podcasts' },
]

const MAX_VISIBLE = 5

export default function FounderResourcesPage() {
  const resources = useQuery(api.resources.listForFounder) as ResourceItem[] | undefined
  const topics = useQuery(api.resources.listTopics)
  const submitForApproval = useMutation(api.resources.submitForApproval)
  const generateUploadUrl = useMutation(api.resources.generateSubmissionUploadUrl)

  const [searchQuery, setSearchQuery] = useState('')
  const [topicFilter, setTopicFilter] = useState<string>('all')

  // Suggest resource modal state
  const [isSuggestOpen, setIsSuggestOpen] = useState(false)
  const [suggestTitle, setSuggestTitle] = useState('')
  const [suggestMediaType, setSuggestMediaType] = useState<MediaType>('video')
  const [suggestTopic, setSuggestTopic] = useState('')
  const [suggestDescription, setSuggestDescription] = useState('')
  const [suggestUrl, setSuggestUrl] = useState('')
  const [suggestFile, setSuggestFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function resetSuggestForm() {
    setSuggestTitle('')
    setSuggestMediaType('video')
    setSuggestTopic('')
    setSuggestDescription('')
    setSuggestUrl('')
    setSuggestFile(null)
  }

  async function handleSuggest() {
    if (!suggestTitle) {
      toast.error('Please fill in the title')
      return
    }
    setIsSubmitting(true)
    try {
      let storageId: Id<'_storage'> | undefined
      let fileName: string | undefined

      if (suggestFile) {
        const uploadUrl = await generateUploadUrl()
        const result = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': suggestFile.type },
          body: suggestFile,
        })
        if (!result.ok) throw new Error('Failed to upload file')
        const { storageId: sid } = await result.json()
        storageId = sid
        fileName = suggestFile.name
      }

      await submitForApproval({
        title: suggestTitle,
        category: suggestMediaType,
        topic: suggestTopic || undefined,
        description: suggestDescription || undefined,
        url: suggestUrl || undefined,
        storageId,
        fileName,
      })
      toast.success('Resource submitted for approval!')
      setIsSuggestOpen(false)
      resetSuggestForm()
    } catch (error) {
      logClientError('Failed to submit resource suggestion:', error)
      toast.error('Failed to submit resource')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredResources = useMemo(() => {
    if (!resources) return null
    const normalized = searchQuery.trim().toLowerCase()
    return resources.filter((r) => {
      const matchesTopic =
        topicFilter === 'all' || (topicFilter === '__none__' ? !r.topic : r.topic === topicFilter)
      const matchesSearch =
        normalized.length === 0 ||
        r.title.toLowerCase().includes(normalized) ||
        (r.description || '').toLowerCase().includes(normalized) ||
        (r.eventTitle || '').toLowerCase().includes(normalized) ||
        (r.topic || '').toLowerCase().includes(normalized) ||
        (r.fileName || '').toLowerCase().includes(normalized)
      return matchesTopic && matchesSearch
    })
  }, [resources, searchQuery, topicFilter])

  const grouped = useMemo(() => {
    if (!filteredResources) return null
    const map = new Map<MediaType, ResourceItem[]>()
    for (const r of filteredResources) {
      const list = map.get(r.category) ?? []
      list.push(r)
      map.set(r.category, list)
    }
    return map
  }, [filteredResources])

  if (resources === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Resources</h1>
          <p className="text-sm text-muted-foreground">
            Curated content to help you build and grow your startup.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsSuggestOpen(true)}>
          <Lightbulb className="mr-2 h-4 w-4" />
          Suggest Resource
        </Button>
      </div>

      {/* Search + Category filter */}
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resources"
            className="pl-9"
          />
        </div>
        <Select value={topicFilter} onValueChange={setTopicFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {topics?.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {sections.map(({ category, title }) => {
          const items = grouped?.get(category) ?? []
          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                {items.length > 0 ? (
                  <div
                    className={
                      items.length > MAX_VISIBLE
                        ? 'divide-y overflow-y-auto max-h-[280px] -mr-3 pr-3'
                        : 'divide-y'
                    }
                  >
                    {items.map((r) => (
                      <ResourceEntry key={r._id} resource={r} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No matching resources.</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Suggest Resource Modal */}
      <Dialog
        open={isSuggestOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsSuggestOpen(false)
            resetSuggestForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suggest a Resource</DialogTitle>
            <DialogDescription>
              Share a resource you find valuable. It will be reviewed by an admin before being
              added.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 px-1 -mx-1 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="suggest-title">Title</Label>
              <Input
                id="suggest-title"
                value={suggestTitle}
                onChange={(e) => setSuggestTitle(e.target.value)}
                placeholder="e.g. How to Build a Startup"
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Media Type</Label>
                <Select
                  value={suggestMediaType}
                  onValueChange={(v) => setSuggestMediaType(v as MediaType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(mediaTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category (optional)</Label>
                <Select
                  value={suggestTopic || 'none'}
                  onValueChange={(v) => setSuggestTopic(v === 'none' ? '' : v)}
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
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="suggest-desc">Description (optional)</Label>
              <Textarea
                id="suggest-desc"
                value={suggestDescription}
                onChange={(e) => setSuggestDescription(e.target.value)}
                placeholder="Why is this resource valuable?"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="suggest-url">URL (optional)</Label>
              <Input
                id="suggest-url"
                value={suggestUrl}
                onChange={(e) => setSuggestUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="suggest-file">File Upload (optional)</Label>
              <Input
                id="suggest-file"
                type="file"
                onChange={(e) => setSuggestFile(e.target.files?.[0] ?? null)}
                className="cursor-pointer"
              />
              {suggestFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {suggestFile.name} ({(suggestFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsSuggestOpen(false)
                resetSuggestForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSuggest} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
