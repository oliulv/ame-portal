'use client'

import { useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ExternalLink, Download } from 'lucide-react'
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

function ResourceFileLink({
  storageId,
  fileName,
}: {
  storageId: Id<'_storage'>
  fileName?: string
}) {
  const url = useQuery(api.resources.getFileUrl, { storageId })
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
    >
      <Download className="h-3 w-3" />
      {fileName || 'Download'}
    </a>
  )
}

function ResourceEntry({ resource }: { resource: ResourceItem }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b last:border-b-0 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{resource.title}</p>
          {resource.url && (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-primary hover:text-primary/80"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        {resource.eventTitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{resource.eventTitle}</p>
        )}
        {resource.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{resource.description}</p>
        )}
      </div>
      {resource.storageId && (
        <div className="shrink-0">
          <ResourceFileLink storageId={resource.storageId} fileName={resource.fileName} />
        </div>
      )}
    </div>
  )
}

const sections: { category: ResourceCategory; title: string }[] = [
  { category: 'video', title: 'Video' },
  { category: 'podcast', title: 'Podcasts' },
  { category: 'book', title: 'Books' },
  { category: 'other_reading', title: 'Other Reading & Materials' },
]

export default function FounderResourcesPage() {
  const resources = useQuery(api.resources.listForFounder) as ResourceItem[] | undefined

  const grouped = useMemo(() => {
    if (!resources) return null
    const map = new Map<ResourceCategory, ResourceItem[]>()
    for (const r of resources) {
      const list = map.get(r.category) ?? []
      list.push(r)
      map.set(r.category, list)
    }
    return map
  }, [resources])

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
      <div>
        <h1 className="text-2xl font-bold font-display">Resources</h1>
        <p className="text-sm text-muted-foreground">
          Curated content to help you build and grow your startup.
        </p>
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
                  <div>
                    {items.map((r) => (
                      <ResourceEntry key={r._id} resource={r} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    No {title.toLowerCase()} available yet.
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
