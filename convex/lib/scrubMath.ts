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
  /** Rounded mean of days with non-zero traffic in the window. Null when
   * the window is too sparse to trust (would otherwise risk wiping a site's
   * data via a near-zero baseline). */
  baseline: number | null
  /** All non-excluded days in the window. */
  contributingDays: string[]
  /** Subset of contributingDays that had at least 1 session. */
  daysWithTraffic: string[]
  excludedDays: string[]
  /** When baseline is null, why we refused to compute. */
  insufficientReason?: 'no_window' | 'too_sparse'
}

/** Minimum days-with-traffic required before we trust the baseline. Below
 * this we refuse to delete — better to let the operator widen the window
 * than to wipe a site that just has a quiet history. */
const MIN_DAYS_WITH_TRAFFIC = 3

export function computeBaseline(input: BaselineInput): BaselineResult {
  const window = input.windowDays ?? 7
  const target = parseUtcDay(input.spikeDate)
  const excludeSet = new Set(input.otherSpikeDates)
  const byDate = new Map(input.dayCounts.map((dc) => [dc.date, dc.count]))

  const wanted: string[] = []
  for (let i = window; i >= 1; i--) {
    wanted.push(formatUtcDay(new Date(target.getTime() - i * 86_400_000)))
  }

  const contributingDays: string[] = []
  const daysWithTraffic: string[] = []
  const trafficCounts: number[] = []
  const excludedDays: string[] = []

  for (const day of wanted) {
    if (excludeSet.has(day)) {
      excludedDays.push(day)
      continue
    }
    contributingDays.push(day)
    const count = byDate.get(day) ?? 0
    if (count > 0) {
      daysWithTraffic.push(day)
      trafficCounts.push(count)
    }
  }

  if (contributingDays.length === 0) {
    return {
      baseline: null,
      contributingDays,
      daysWithTraffic,
      excludedDays,
      insufficientReason: 'no_window',
    }
  }
  if (daysWithTraffic.length < MIN_DAYS_WITH_TRAFFIC) {
    return {
      baseline: null,
      contributingDays,
      daysWithTraffic,
      excludedDays,
      insufficientReason: 'too_sparse',
    }
  }

  const sum = trafficCounts.reduce((a, b) => a + b, 0)
  return {
    baseline: Math.round(sum / trafficCounts.length),
    contributingDays,
    daysWithTraffic,
    excludedDays,
  }
}

export interface SessionGroup {
  sessionId: string
  eventCount: number
}

export interface TrimPlanInput {
  sessionGroups: SessionGroup[]
  /** When null, planSessionTrim returns an empty plan — the migration must
   * not delete on insufficient baseline. */
  baseline: number | null
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
 *
 * Refuses to plan if `baseline` is null — caller (the migration) should
 * surface the `insufficientReason` instead of deleting blindly.
 */
export function planSessionTrim(input: TrimPlanInput): TrimPlanResult {
  if (input.baseline === null) {
    return {
      sessionIdsToDelete: [],
      remainingSessions: input.sessionGroups.length,
      eventsToDelete: 0,
    }
  }
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
