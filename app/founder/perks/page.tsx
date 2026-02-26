'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Gift, ExternalLink, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { Id } from '@/convex/_generated/dataModel'

type FounderPerk = {
  _id: Id<'perks'>
  _creationTime: number
  cohortId: Id<'cohorts'>
  title: string
  description: string
  details?: string
  category?: string
  providerName?: string
  providerLogoUrl?: string
  url?: string
  isActive: boolean
  sortOrder: number
  isClaimed: boolean
  claimedAt?: string
}

export default function FounderPerksPage() {
  const perks = useQuery(api.perks.listForFounder) as FounderPerk[] | undefined
  const claimPerk = useMutation(api.perks.claim)
  const unclaimPerk = useMutation(api.perks.unclaim)

  const [selectedPerk, setSelectedPerk] = useState<FounderPerk | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  if (perks === undefined) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-16 w-full" />
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
          <h1 className="text-3xl font-bold tracking-tight">Perks</h1>
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

  const claimedCount = perks.filter((p) => p.isClaimed).length

  async function handleClaim(perkId: Id<'perks'>) {
    setIsProcessing(true)
    try {
      await claimPerk({ perkId })
      toast.success('Perk claimed!')
      // Update selected perk state
      if (selectedPerk && selectedPerk._id === perkId) {
        setSelectedPerk({ ...selectedPerk, isClaimed: true, claimedAt: new Date().toISOString() })
      }
    } catch (error) {
      console.error('Failed to claim perk:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to claim perk')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleUnclaim(perkId: Id<'perks'>) {
    setIsProcessing(true)
    try {
      await unclaimPerk({ perkId })
      toast.success('Perk unclaimed')
      if (selectedPerk && selectedPerk._id === perkId) {
        setSelectedPerk({ ...selectedPerk, isClaimed: false, claimedAt: undefined })
      }
    } catch (error) {
      console.error('Failed to unclaim perk:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to unclaim perk')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Perks</h1>
        <p className="text-muted-foreground">Partner deals and discounts</p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Perks Claimed</span>
            <span className="text-sm text-muted-foreground">
              {claimedCount} of {perks.length} perks claimed
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${perks.length > 0 ? (claimedCount / perks.length) * 100 : 0}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Perks grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {perks.map((perk) => (
          <Card
            key={perk._id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              perk.isClaimed ? 'border-l-4 border-l-green-500' : ''
            }`}
            onClick={() => setSelectedPerk(perk)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {perk.providerName && (
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      {perk.providerName}
                    </p>
                  )}
                  <h3 className="font-semibold leading-tight">{perk.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                    {perk.description}
                  </p>
                </div>
                {perk.isClaimed && (
                  <Badge variant="success" className="shrink-0">
                    <Check className="mr-1 h-3 w-3" />
                    Claimed
                  </Badge>
                )}
              </div>
              {perk.category && (
                <div className="mt-3">
                  <Badge variant="outline">{perk.category}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Perk detail dialog */}
      <Dialog open={!!selectedPerk} onOpenChange={(open) => !open && setSelectedPerk(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPerk?.title}</DialogTitle>
            {selectedPerk?.providerName && (
              <DialogDescription>by {selectedPerk.providerName}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm">{selectedPerk?.description}</p>
            {selectedPerk?.details && (
              <p className="text-sm text-muted-foreground">{selectedPerk.details}</p>
            )}
            {selectedPerk?.category && (
              <div>
                <Badge variant="outline">{selectedPerk.category}</Badge>
              </div>
            )}
            {selectedPerk?.isClaimed && selectedPerk.claimedAt && (
              <p className="text-xs text-muted-foreground">
                Claimed on{' '}
                {new Date(selectedPerk.claimedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {selectedPerk?.url && (
              <Button variant="outline" asChild>
                <a href={selectedPerk.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Visit Link
                </a>
              </Button>
            )}
            {selectedPerk?.isClaimed ? (
              <Button
                variant="outline"
                onClick={() => selectedPerk && handleUnclaim(selectedPerk._id)}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Unclaim'}
              </Button>
            ) : (
              <Button
                onClick={() => selectedPerk && handleClaim(selectedPerk._id)}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Claim Perk'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
