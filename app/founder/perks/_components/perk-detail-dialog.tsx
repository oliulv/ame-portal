import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
        <DialogHeader className="text-left">
          <DialogTitle>{perk?.title}</DialogTitle>
          {perk?.providerName && <DialogDescription>by {perk.providerName}</DialogDescription>}
        </DialogHeader>
        {perk?.category && (
          <div className="flex flex-wrap gap-1">
            {perk.category.split(',').map((cat) => (
              <Badge key={cat.trim()} variant="secondary" className="border-border">
                {cat.trim()}
              </Badge>
            ))}
          </div>
        )}
        <div className="space-y-3">
          <p className="text-sm">{perk?.description}</p>
          {perk?.details && <p className="text-sm text-muted-foreground">{perk.details}</p>}
        </div>
        <div className="flex items-center justify-between pt-2">
          <div>
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
          <div className="flex items-center gap-2 shrink-0">
            {perk?.url && (
              <a
                href={perk.url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Visit
              </a>
            )}
            {perk?.isClaimed ? (
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => perk && onUnclaim(perk._id)}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Unclaim'}
              </Button>
            ) : (
              <Button
                size="sm"
                className="whitespace-nowrap"
                onClick={() => perk && onClaim(perk._id)}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Claim Perk'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
