'use client'

import { useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ExternalLink, Download, Search, BookOpen } from 'lucide-react'
import type { Id } from '@/convex/_generated/dataModel'

type ResourceCategory = 'video' | 'podcast' | 'book' | 'other_reading'

type ResourceItem = {
  _id: Id<'resources'>
  title: string
  category: ResourceCategory
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
        </div>
        {resource.eventTitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{resource.eventTitle}</p>
        )}
      </div>
      {resource.storageId && resource.fileName && (
        <div className="shrink-0 flex items-center gap-1 text-sm text-muted-foreground">
          <Download className="h-3.5 w-3.5" />
          <span>{resource.fileName}</span>
        </div>
      )}
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

const sections: { category: ResourceCategory; title: string }[] = [
  { category: 'video', title: 'Video' },
  { category: 'podcast', title: 'Podcasts' },
  { category: 'book', title: 'Books' },
  { category: 'other_reading', title: 'Other Reading & Materials' },
]

export default function FounderResourcesPage() {
  const resources = useQuery(api.resources.listForFounder) as ResourceItem[] | undefined
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const filteredResources = useMemo(() => {
    if (!resources) return null
    const normalized = searchQuery.trim().toLowerCase()
    return resources.filter((r) => {
      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter
      const matchesSearch =
        normalized.length === 0 ||
        r.title.toLowerCase().includes(normalized) ||
        (r.description || '').toLowerCase().includes(normalized) ||
        (r.eventTitle || '').toLowerCase().includes(normalized) ||
        (r.fileName || '').toLowerCase().includes(normalized)
      return matchesCategory && matchesSearch
    })
  }, [resources, searchQuery, categoryFilter])

  const grouped = useMemo(() => {
    if (!filteredResources) return null
    const map = new Map<ResourceCategory, ResourceItem[]>()
    for (const r of filteredResources) {
      const list = map.get(r.category) ?? []
      list.push(r)
      map.set(r.category, list)
    }
    return map
  }, [filteredResources])

  const visibleSections = useMemo(() => {
    if (categoryFilter === 'all') return sections
    return sections.filter((s) => s.category === categoryFilter)
  }, [categoryFilter])

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

  const hasResults = visibleSections.some((s) => (grouped?.get(s.category) ?? []).length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Resources</h1>
        <p className="text-sm text-muted-foreground">
          Curated content to help you build and grow your startup.
        </p>
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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="podcast">Podcast</SelectItem>
            <SelectItem value="book">Book</SelectItem>
            <SelectItem value="other_reading">Other Reading</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasResults ? (
        <div className="grid gap-6 md:grid-cols-2">
          {visibleSections.map(({ category, title }) => {
            const items = grouped?.get(category) ?? []
            if (items.length === 0) return null
            return (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {items.map((r) => (
                      <ResourceEntry key={r._id} resource={r} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="No resources match your search"
          description="Try adjusting the search term or selected category."
        />
      )}
    </div>
  )
}
