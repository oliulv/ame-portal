// Pure helpers for the spike-scrub migration.
//
// Two responsibilities:
//   1. compute a per-day session-count baseline from the N days preceding
//      a spike (excluding other known spike dates).
//   2. given a spike day's sessions, plan which session clusters to delete
//      so the surviving session count lands at baseline.
//
// Both functions are pure — the migration handler does the DB I/O.

export interface DayCount {
  /** UTC date in `YYYY-MM-DD` form. */
  date: string
  /** Unique session count for that day. */
  count: number
}

export interface BaselineInput {
  /** Daily session counts available in the lookback window. */
  dayCounts: DayCount[]
  /** Spike date being analyzed (`YYYY-MM-DD` UTC). */
  spikeDate: string
  /** Other spike dates to exclude from the baseline window. */
  otherSpikeDates: string[]
  /** How many days to look back. Default 7. */
  windowDays?: number
}

export interface BaselineResult {
  /** Rounded mean of contributing-day session counts. */
  baseline: number
  contributingDays: string[]
  excludedDays: string[]
}

export function computeBaseline(input: BaselineInput): BaselineResult {
  const window = input.windowDays ?? 7
  const target = parseUtcDay(input.spikeDate)
  const excludeSet = new Set(input.otherSpikeDates)
  const byDate = new Map(input.dayCounts.map((dc) => [dc.date, dc.count]))

  const wanted: string[] = []
  for (let i = window; i >= 1; i--) {
    wanted.push(formatUtcDay(new Date(target.getTime() - i * 86_400_000)))
  }

  const contributing: number[] = []
  const contributingDays: string[] = []
  const excludedDays: string[] = []

  for (const day of wanted) {
    if (excludeSet.has(day)) {
      excludedDays.push(day)
      continue
    }
    contributing.push(byDate.get(day) ?? 0)
    contributingDays.push(day)
  }

  if (contributing.length === 0) {
    return { baseline: 0, contributingDays, excludedDays }
  }
  const sum = contributing.reduce((a, b) => a + b, 0)
  return {
    baseline: Math.round(sum / contributing.length),
    contributingDays,
    excludedDays,
  }
}

export interface SessionGroup {
  sessionId: string
  eventCount: number
}

export interface TrimPlanInput {
  sessionGroups: SessionGroup[]
  baseline: number
}

export interface TrimPlanResult {
  sessionIdsToDelete: string[]
  remainingSessions: number
  eventsToDelete: number
}

/**
 * Pick the largest session clusters first — bot scripts tend to fan out
 * many events onto one session id, so the heaviest clusters are usually
 * the inflated ones. Preserves the long tail of small real sessions.
 */
export function planSessionTrim(input: TrimPlanInput): TrimPlanResult {
  const current = input.sessionGroups.length
  if (current <= input.baseline) {
    return { sessionIdsToDelete: [], remainingSessions: current, eventsToDelete: 0 }
  }
  const sortedDesc = [...input.sessionGroups].sort((a, b) => {
    if (b.eventCount !== a.eventCount) return b.eventCount - a.eventCount
    // Stable secondary sort on sessionId so the plan is reproducible.
    return a.sessionId.localeCompare(b.sessionId)
  })
  const toDeleteCount = current - input.baseline
  const slice = sortedDesc.slice(0, toDeleteCount)
  return {
    sessionIdsToDelete: slice.map((g) => g.sessionId),
    remainingSessions: current - toDeleteCount,
    eventsToDelete: slice.reduce((a, g) => a + g.eventCount, 0),
  }
}

function parseUtcDay(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) throw new Error(`invalid UTC day: ${s}`)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

function formatUtcDay(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
