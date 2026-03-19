'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Megaphone, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnnouncementsTab } from './_components/announcements-tab'
import { NotificationsTab } from './_components/notifications-tab'

type CommsTab = 'announcements' | 'notifications'

const tabs: { id: CommsTab; label: string; icon: typeof Megaphone }[] = [
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

export default function CommsPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const [activeTab, setActiveTab] = useState<CommsTab>('announcements')

  const cohort = useQuery(api.cohorts.getBySlug, { slug: cohortSlug })
  const canManageNotifications = useQuery(
    api.announcements.canSend,
    cohort ? { cohortId: cohort._id } : 'skip'
  )

  if (cohort === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!cohort) {
    return <p className="text-muted-foreground">Cohort not found</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Comms</h1>
        <p className="text-muted-foreground">Announcements and notification management</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => {
          // Hide notifications tab if user doesn't have permission
          if (tab.id === 'notifications' && !canManageNotifications) return null

          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'announcements' && <AnnouncementsTab cohortSlug={cohortSlug} />}
      {activeTab === 'notifications' && canManageNotifications && (
        <NotificationsTab cohortSlug={cohortSlug} cohortId={cohort._id} />
      )}
    </div>
  )
}
