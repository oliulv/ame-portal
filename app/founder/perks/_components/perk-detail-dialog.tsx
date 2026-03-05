'use client'

import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExternalLink, Gift, Loader2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { FounderPerk } from '../page'
import type { Id } from '@/convex/_generated/dataModel'

interface PerkDetailDialogProps {
  perk: FounderPerk | null
  isProcessing: boolean
  onClose: () => void
  onClaim: (perkId: Id<'perks'>) => void
  onUnclaim: (perkId: Id<'perks'>) => void
}

function SupabaseRedemption({ perk }: { perk: FounderPerk }) {
  const redeemSupabase = useAction(api.perks.redeemSupabase)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [redemption, setRedemption] = useState<{
    code: string
    link: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleRedeem() {
    setIsRedeeming(true)
    try {
      const result = await redeemSupabase({ perkId: perk._id })
      setRedemption(result)
      toast.success('Supabase credits redeemed!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to redeem'
      if (message.includes('already been redeemed')) {
        toast.error('Credits have already been redeemed for your account')
      } else {
        toast.error(message)
      }
    } finally {
      setIsRedeeming(false)
    }
  }

  function handleCopy() {
    if (!redemption) return
    navigator.clipboard.writeText(redemption.code)
    setCopied(true)
    toast.success('Code copied')
    setTimeout(() => setCopied(false), 2000)
  }

  if (redemption) {
    return (
      <div className="space-y-3 rounded-md border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-green-600">
          <Check className="h-4 w-4" />
          Code generated — follow the link below to apply it
        </div>
        <p className="text-xs text-muted-foreground">
          Click &quot;Redeem on Supabase&quot;, sign in with your Supabase account, choose which
          organisation to apply the credits to, and confirm.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-background px-3 py-2 text-sm font-mono border">
            {redemption.code}
          </code>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <a
          href={redemption.link}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: 'sm', className: 'w-full' })}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-2" />
          Redeem on Supabase
        </a>
      </div>
    )
  }

  return (
    <Button size="sm" onClick={handleRedeem} disabled={isRedeeming}>
      {isRedeeming ? (
        <>
          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
          Generating code...
        </>
      ) : (
        <>
          <Gift className="h-3.5 w-3.5 mr-2" />
          Redeem Credits
        </>
      )}
    </Button>
  )
}

export function PerkDetailDialog({
  perk,
  isProcessing,
  onClose,
  onClaim,
  onUnclaim,
}: PerkDetailDialogProps) {
  const isSupabase = perk?.providerName?.trim() === 'Supabase'

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

        {isSupabase && perk && <SupabaseRedemption perk={perk} />}

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
            {!isSupabase && perk?.url && (
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
              !isSupabase && (
                <Button
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => perk && onClaim(perk._id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Claim Perk'}
                </Button>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
