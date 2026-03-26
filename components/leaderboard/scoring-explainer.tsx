import { Card, CardContent } from '@/components/ui/card'

export const CATEGORY_COLORS: Record<string, string> = {
  revenue: 'bg-emerald-500',
  traffic: 'bg-blue-500',
  github: 'bg-purple-500',
  updates: 'bg-orange-500',
  milestones: 'bg-yellow-500',
}

export const CATEGORY_LABELS: Record<string, string> = {
  revenue: 'Revenue',
  traffic: 'Traffic',
  github: 'GitHub',
  updates: 'Updates',
  milestones: 'Milestones',
}

export const CATEGORY_WEIGHTS: Record<string, number> = {
  revenue: 25,
  traffic: 20,
  github: 20,
  updates: 20,
  milestones: 15,
}

export function ScoringExplainerContent() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div>
          <h3 className="font-semibold mb-3">Categories & Weights</h3>
          <div className="space-y-2">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <div className={`h-3 w-3 shrink-0 ${CATEGORY_COLORS[key]}`} />
                <span className="text-sm w-20 shrink-0">{label}</span>
                <div className="h-2 bg-muted overflow-hidden" style={{ width: '120px' }}>
                  <div
                    className={`h-full ${CATEGORY_COLORS[key]}`}
                    style={{ width: `${(CATEGORY_WEIGHTS[key] / 22) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground shrink-0">
                  {CATEGORY_WEIGHTS[key]}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium mb-1">Rolling 4-Week Window</h4>
            <p className="text-muted-foreground">Only the last 4 weeks count.</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Temporal Decay</h4>
            <p className="text-muted-foreground">This week 100%, last week ~81%, 2 weeks ~66%.</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">40% Cap</h4>
            <p className="text-muted-foreground">No single category can exceed 40%.</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Qualification Gate</h4>
            <p className="text-muted-foreground">
              Need activity in 3+ of 5 categories for &quot;Qualified&quot; tag.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Consistency Bonus</h4>
            <p className="text-muted-foreground">Steady performance earns up to +5%.</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Momentum Arrows</h4>
            <p className="text-muted-foreground">
              Compare this week vs last — &gt;5% change = up or down.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
