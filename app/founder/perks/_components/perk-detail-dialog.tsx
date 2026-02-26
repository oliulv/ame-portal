import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExternalLink } from 'lucide-react'
import type { FounderPerk } from '../page'
import type { Id } from '@/convex/_generated/dataModel'

interface PerkDetailDialogProps {
  perk: FounderPerk | null
  isProcessing: boolean
  onClose: () => void
  onClaim: (perkId: Id<'perks'>) => void
  onUnclaim: (perkId: Id<'perks'>) => void
}

export function PerkDetailDialog({
  perk,
  isProcessing,
  onClose,
  onClaim,
  onUnclaim,
}: PerkDetailDialogProps) {
  return (
    <Dialog open={!!perk} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{perk?.title}</DialogTitle>
          {perk?.providerName && <DialogDescription>by {perk.providerName}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm">{perk?.description}</p>
          {perk?.details && <p className="text-sm text-muted-foreground">{perk.details}</p>}
          {perk?.category && (
            <div className="flex flex-wrap gap-1">
              {perk.category.split(',').map((cat) => (
                <Badge key={cat.trim()} variant="secondary">
                  {cat.trim()}
                </Badge>
              ))}
            </div>
          )}
          {perk?.isClaimed && perk.claimedAt && (
            <p className="text-xs text-muted-foreground">
              Claimed on{' '}
              {new Date(perk.claimedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {perk?.url && (
            <Button variant="outline" asChild>
              <a href={perk.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Visit Link
              </a>
            </Button>
          )}
          {perk?.isClaimed ? (
            <Button
              variant="outline"
              onClick={() => perk && onUnclaim(perk._id)}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Unclaim'}
            </Button>
          ) : (
            <Button onClick={() => perk && onClaim(perk._id)} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Claim Perk'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
