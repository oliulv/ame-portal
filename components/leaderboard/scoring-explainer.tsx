import { Card, CardContent } from '@/components/ui/card'

export const CATEGORY_COLORS: Record<string, string> = {
  revenue: 'bg-emerald-500',
  traffic: 'bg-blue-500',
  github: 'bg-purple-500',
  updates: 'bg-orange-500',
  milestones: 'bg-yellow-500',
}

export const CATEGORY_LABELS: Record<string, string> = {
  revenue: 'MRR',
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

const CATEGORY_DETAILS: Record<string, { signal: string; measurement: string; example: string }> = {
  revenue: {
    signal: 'Monthly Recurring Revenue growth',
    measurement:
      'Your MRR from Stripe subscriptions. We snapshot it each week and compare to last week to measure momentum — MRR itself is always a monthly figure.',
    example: 'If your MRR was £5,000 last week and £6,000 this week, that is 20% growth.',
  },
  traffic: {
    signal: 'Session growth rate',
    measurement: 'Week-over-week % change in unique sessions from your website tracker',
    example: 'Doubling visitors in a week scores higher than steady high traffic',
  },
  github: {
    signal: 'Shipping velocity',
    measurement: 'Commits (10 pts) + PRs opened (25 pts), summed across all founders',
    example: '5 commits + 2 PRs = 100 pts for that day',
  },
  updates: {
    signal: 'Weekly update submitted',
    measurement:
      'Binary (submitted or not) + streak bonus: +10% per consecutive week, up to +80% at 8 weeks',
    example: 'Submit every week for 8 weeks = nearly double the base score',
  },
  milestones: {
    signal: 'Milestone completion rate',
    measurement: 'Approved milestones / total due milestones over the cohort lifetime',
    example: '4 of 5 milestones completed = 80% completion rate',
  },
}

export function ScoringExplainerContent() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* Category breakdown table */}
        <div>
          <h3 className="font-semibold mb-3">How each category is scored</h3>
          <div className="border overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">
                    Category
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-16">
                    Weight
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    What we measure
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden md:table-cell">
                    Example
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(CATEGORY_DETAILS).map(([key, detail]) => (
                  <tr key={key}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 shrink-0 ${CATEGORY_COLORS[key]}`} />
                        <span className="font-medium">{CATEGORY_LABELS[key]}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{CATEGORY_WEIGHTS[key]}%</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-xs text-muted-foreground mb-0.5">
                        {detail.signal}
                      </p>
                      <p>{detail.measurement}</p>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                      {detail.example}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            <strong>Only active Stripe subscriptions count toward MRR.</strong> One-off payments,
            invoices, consulting revenue, usage-based billing, and anything outside Stripe
            subscriptions are not tracked on the leaderboard.
          </p>
        </div>

        {/* Scoring mechanics */}
        <div>
          <h3 className="font-semibold mb-3">How your score is calculated</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border p-3 space-y-1">
              <h4 className="font-medium text-sm">Rolling 4-Week Window</h4>
              <p className="text-sm text-muted-foreground">
                Only the last 4 weeks of activity count. Old work expires so the leaderboard
                reflects who is shipping <em>now</em>.
              </p>
            </div>
            <div className="border p-3 space-y-1">
              <h4 className="font-medium text-sm">Temporal Decay</h4>
              <p className="text-sm text-muted-foreground">
                Recent activity is worth more. This week = 100%, last week = ~81%, 2 weeks ago =
                ~66%, 3 weeks ago = ~53%.
              </p>
            </div>
            <div className="border p-3 space-y-1">
              <h4 className="font-medium text-sm">Qualification Gate</h4>
              <p className="text-sm text-muted-foreground">
                Need data in at least 3 of 5 categories to earn the &quot;Qualified&quot; tag (extra
                funding eligibility). Categories you haven&apos;t connected are simply excluded
                &mdash; no penalty.
              </p>
            </div>
            <div className="border p-3 space-y-1">
              <h4 className="font-medium text-sm">Consistency Bonus</h4>
              <p className="text-sm text-muted-foreground">
                Steady week-over-week performance earns up to +5%. High variance (big spikes then
                nothing) incurs a -5% penalty.
              </p>
            </div>
            <div className="border p-3 space-y-1">
              <h4 className="font-medium text-sm">40% Cap</h4>
              <p className="text-sm text-muted-foreground">
                No single category can contribute more than 40% of your total score, even if you
                dominate in one area. Breadth matters.
              </p>
            </div>
            <div className="border p-3 space-y-1">
              <h4 className="font-medium text-sm">Momentum Arrows</h4>
              <p className="text-sm text-muted-foreground">
                Compares your total score this week vs last week. &gt;5% increase = trending up,
                &gt;5% decrease = trending down.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
