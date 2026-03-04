'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { logClientError } from '@/lib/logging'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Gift } from 'lucide-react'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'
import { PerkCard } from './_components/perk-card'
import { PerkDetailDialog } from './_components/perk-detail-dialog'
import { PerksToolbar } from './_components/perks-toolbar'

export type FounderPerk = {
  _id: Id<'perks'>
  _creationTime: number
  title: string
  description: string
  details?: string
  category?: string
  providerName?: string
  providerLogoUrl?: string
  url?: string
  isActive: boolean
  isPartnership?: boolean
  sortOrder: number
  isClaimed: boolean
  claimedAt?: string
}

export default function FounderPerksPage() {
  const perks = useQuery(api.perks.listForFounder) as FounderPerk[] | undefined
  const claimPerk = useMutation(api.perks.claim)
  const unclaimPerk = useMutation(api.perks.unclaim)

  const [selectedPerkId, setSelectedPerkId] = useState<Id<'perks'> | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const allCategories = useMemo(() => {
    if (!perks) return []
    const cats = new Set<string>()
    for (const perk of perks) {
      if (perk.category) {
        for (const cat of perk.category.split(',')) {
          cats.add(cat.trim())
        }
      }
    }
    return Array.from(cats).sort()
  }, [perks])

  const filteredPerks = useMemo(() => {
    if (!perks) return []
    return perks.filter((perk) => {
      if (categoryFilter !== 'all') {
        const perkCategories = perk.category ? perk.category.split(',').map((c) => c.trim()) : []
        if (!perkCategories.includes(categoryFilter)) return false
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = perk.title.toLowerCase().includes(query)
        const matchesDescription = perk.description.toLowerCase().includes(query)
        const matchesProvider = perk.providerName?.toLowerCase().includes(query) ?? false
        if (!matchesTitle && !matchesDescription && !matchesProvider) return false
      }
      return true
    })
  }, [perks, searchQuery, categoryFilter])

  const selectedPerk = useMemo(() => {
    if (!selectedPerkId || !perks) return null
    return perks.find((p) => p._id === selectedPerkId) ?? null
  }, [selectedPerkId, perks])

  const claimedCount = useMemo(() => {
    if (!perks) return 0
    return perks.filter((p) => p.isClaimed).length
  }, [perks])

  const handleClaim = useCallback(
    async (perkId: Id<'perks'>) => {
      setIsProcessing(true)
      try {
        await claimPerk({ perkId })
        toast.success('Perk claimed!')
      } catch (error) {
        logClientError('Failed to claim perk:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to claim perk')
      } finally {
        setIsProcessing(false)
      }
    },
    [claimPerk]
  )

  const handleUnclaim = useCallback(
    async (perkId: Id<'perks'>) => {
      setIsProcessing(true)
      try {
        await unclaimPerk({ perkId })
        toast.success('Perk unclaimed')
      } catch (error) {
        logClientError('Failed to unclaim perk:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to unclaim perk')
      } finally {
        setIsProcessing(false)
      }
    },
    [unclaimPerk]
  )

  const handleSelectPerk = useCallback((perk: FounderPerk) => {
    setSelectedPerkId(perk._id)
  }, [])

  const handleCloseDialog = useCallback(() => {
    setSelectedPerkId(null)
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
  }, [])

  const handleCategoryChange = useCallback((value: string) => {
    setCategoryFilter(value)
  }, [])

  if (perks === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (perks.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Perks</h1>
          <p className="text-muted-foreground">Partner deals and discounts</p>
        </div>
        <EmptyState
          icon={<Gift className="h-6 w-6" />}
          title="No perks available"
          description="Perks and partner deals will appear here when they are set up by your program admin."
        />
      </div>
    )
  }

  const hasActiveFilters = searchQuery !== '' || categoryFilter !== 'all'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Perks</h1>
          <p className="text-muted-foreground">Partner deals and discounts</p>
        </div>
        <div className="flex items-center gap-2">
          <svg className="h-12 w-12" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-muted"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="text-emerald-500"
              strokeDasharray={`${perks.length > 0 ? (claimedCount / perks.length) * 97.4 : 0} 97.4`}
              transform="rotate(-90 18 18)"
            />
            <text
              x="18"
              y="18"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground text-[8px] font-semibold"
            >
              {claimedCount}/{perks.length}
            </text>
          </svg>
          <span className="text-xs text-muted-foreground">claimed</span>
        </div>
      </div>

      {/* Toolbar */}
      <PerksToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        categoryFilter={categoryFilter}
        onCategoryChange={handleCategoryChange}
        categories={allCategories}
      />

      {/* Result count */}
      {hasActiveFilters && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredPerks.length} of {perks.length} perks
        </p>
      )}

      {/* Perks grouped by partnership */}
      {filteredPerks.length > 0 ? (
        <>
          {filteredPerks.some((p) => p.isPartnership) && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Accelerate ME Partnerships</h2>
                <p className="text-sm text-muted-foreground">
                  Exclusive deals negotiated for Accelerate ME startups
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPerks
                  .filter((p) => p.isPartnership)
                  .map((perk) => (
                    <PerkCard key={perk._id} perk={perk} onSelect={handleSelectPerk} />
                  ))}
              </div>
            </div>
          )}

          {filteredPerks.some((p) => !p.isPartnership) && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Startup Programs</h2>
                <p className="text-sm text-muted-foreground">
                  Open programs you can apply to independently
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPerks
                  .filter((p) => !p.isPartnership)
                  .map((perk) => (
                    <PerkCard key={perk._id} perk={perk} onSelect={handleSelectPerk} />
                  ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={<Gift className="h-6 w-6" />}
          title="No perks found"
          description="Try adjusting your search or filter to find what you're looking for."
        />
      )}

      {/* Perk detail dialog */}
      <PerkDetailDialog
        perk={selectedPerk}
        isProcessing={isProcessing}
        onClose={handleCloseDialog}
        onClaim={handleClaim}
        onUnclaim={handleUnclaim}
      />
    </div>
  )
}
