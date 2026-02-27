import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { FounderPerk } from '../page'

interface PerkCardProps {
  perk: FounderPerk
  onSelect: (perk: FounderPerk) => void
}

export const PerkCard = memo(function PerkCard({ perk, onSelect }: PerkCardProps) {
  const categories = perk.category ? perk.category.split(',').map((c) => c.trim()) : []
  const visibleCategories = categories.slice(0, 2)
  const overflowCount = categories.length - 2

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md hover:border-foreground/20 ${
        perk.isClaimed ? 'bg-emerald-50/50' : ''
      }`}
      onClick={() => onSelect(perk)}
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
            <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{perk.description}</p>
          </div>
          {perk.isClaimed && (
            <Badge variant="success" className="shrink-0">
              Claimed
            </Badge>
          )}
        </div>
        {visibleCategories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {visibleCategories.map((cat) => (
              <Badge key={cat} variant="secondary" className="border-border">
                {cat}
              </Badge>
            ))}
            {overflowCount > 0 && (
              <Badge variant="secondary" className="border-border">
                +{overflowCount} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
})
