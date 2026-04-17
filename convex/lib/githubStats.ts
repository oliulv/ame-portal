/**
 * Pure helpers for shaping GitHub data before it lands in the DB / UI.
 * Kept outside `metrics.ts` so they can be unit-tested without mocking
 * Convex, and so future refactors can't silently reinstate the bugs these
 * helpers lock in:
 *   - `normalizeGithubStatsMeta` — backward-compat for stored per-founder
 *     stats rows that predate the `restricted` field.
 *   - `buildFounderTypedCalendar` — null-guarded typed-calendar builder
 *     that intentionally does NOT reconcile against the merged calendar
 *     (private-repo contributions must not be misattributed to commits).
 *   - Search-result helpers — convert GitHub search API hits into the same
 *     typed/day-level shapes used by scoring, so we can recover private
 *     commits/PRs/issues that `viewer.contributionsCollection` refuses to
 *     classify for GitHub App user tokens.
 */

import type { MergedCalendarWeek, TypedDayCounts } from './scoring'

export type FounderGithubStats = {
  commits: number
  prs: number
  issues: number
  restricted: number
}

export type SearchContributionHit = {
  occurredAt?: string | null
  count?: number | null
}

/**
 * Normalize raw per-founder stats meta into a consistent shape.
 *
 * Rows written before the `restricted` field existed lack it; rows written
 * by an incomplete earlier sync could theoretically be missing any field.
 * Every missing numeric defaults to 0 so callers can trust the shape.
 */
export function normalizeGithubStatsMeta(
  raw: Record<string, Partial<FounderGithubStats>> | undefined
): Record<string, FounderGithubStats> {
  if (!raw) return {}
  const out: Record<string, FounderGithubStats> = {}
  for (const [name, stats] of Object.entries(raw)) {
    out[name] = {
      commits: stats?.commits ?? 0,
      prs: stats?.prs ?? 0,
      issues: stats?.issues ?? 0,
      restricted: stats?.restricted ?? 0,
    }
  }
  return out
}

function ensureTypedDay(typed: TypedDayCounts, date: string) {
  typed[date] ??= { commits: 0, prs: 0, issues: 0 }
  return typed[date]
}

/**
 * Convert normalized search hits into per-day typed counts.
 *
 * Search-derived data is the reliable path for private repos with GitHub App
 * user access tokens. The profile contribution endpoints still mark that work
 * as "restricted" even when the same token can search/read the private repos.
 */
export function buildTypedDayCountsFromSearchResults(input: {
  commits?: SearchContributionHit[]
  prs?: SearchContributionHit[]
  issues?: SearchContributionHit[]
}): TypedDayCounts {
  const typed: TypedDayCounts = {}

  for (const hit of input.commits ?? []) {
    if (!hit?.occurredAt) continue
    const date = hit.occurredAt.slice(0, 10)
    ensureTypedDay(typed, date).commits += Math.max(0, hit.count ?? 1)
  }

  for (const hit of input.prs ?? []) {
    if (!hit?.occurredAt) continue
    const date = hit.occurredAt.slice(0, 10)
    ensureTypedDay(typed, date).prs += Math.max(0, hit.count ?? 1)
  }

  for (const hit of input.issues ?? []) {
    if (!hit?.occurredAt) continue
    const date = hit.occurredAt.slice(0, 10)
    ensureTypedDay(typed, date).issues += Math.max(0, hit.count ?? 1)
  }

  return typed
}

export function sumTypedContributionCount(typed: TypedDayCounts): number {
  return Object.values(typed).reduce((sum, day) => sum + day.commits + day.prs + day.issues, 0)
}

/**
 * Compute the residual between GitHub's coarse total contribution count and
 * the contributions we could explicitly classify as commits/PRs/issues.
 *
 * This is intentionally NOT named "private contributions" in the helper
 * because the gap may also include unsupported GitHub contribution types.
 */
export function computeUnattributedContributionCount(
  totalContributionCount: number,
  typed: TypedDayCounts
): number {
  return Math.max(0, totalContributionCount - sumTypedContributionCount(typed))
}

function parseIsoDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Build GitHub-style contribution weeks (Sunday-first, oldest-first) from a
 * typed/day calendar. Missing days are zero-filled so the frontend heatmap
 * keeps a stable weekly grid.
 */
export function buildContributionCalendarWeeksFromTypedDayCounts(
  typed: TypedDayCounts,
  range: { from: string; to: string }
): MergedCalendarWeek[] {
  const from = parseIsoDateOnly(range.from)
  const to = parseIsoDateOnly(range.to)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return []

  const start = new Date(from)
  start.setUTCDate(start.getUTCDate() - start.getUTCDay())

  const end = new Date(to)
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()))

  const weeks: MergedCalendarWeek[] = []
  const cursor = new Date(start)

  while (cursor <= end) {
    const contributionDays: Array<{ date: string; contributionCount?: number }> = []
    for (let i = 0; i < 7; i++) {
      const date = toIsoDateOnly(cursor)
      const day = typed[date]
      contributionDays.push({
        date,
        contributionCount: day ? day.commits + day.prs + day.issues : 0,
      })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    weeks.push({ contributionDays })
  }

  return weeks
}

/**
 * Loose shape of the subset of `contributionsCollection` we actually read.
 * GitHub returns `null` entries for restricted contributions inside the
 * node arrays, so every access must be guarded.
 */
export interface ContributionsInput {
  commitContributionsByRepository?: Array<{
    contributions?: {
      nodes?: Array<{ commitCount?: number | null; occurredAt?: string | null } | null> | null
    } | null
  } | null> | null
  pullRequestContributions?: {
    nodes?: Array<{ occurredAt?: string | null } | null> | null
  } | null
  issueContributions?: {
    nodes?: Array<{ occurredAt?: string | null } | null> | null
  } | null
}

/**
 * Build a per-type per-day calendar for a single founder from GitHub's
 * contributionsCollection response.
 *
 * Key correctness properties (DO NOT BREAK):
 *   1. A single null node anywhere in the response must not throw.
 *      GitHub returns null entries for restricted/private-repo
 *      contributions, and a throw would drop the whole founder's data.
 *   2. We do NOT reconcile the typed counts against the merged
 *      `contributionCalendar` total. When the App is not installed on a
 *      founder's private repos, the detail nodes come back empty while
 *      the merged total still counts them. Attributing that gap to
 *      commits silently relabels private PRs/issues as commits on the
 *      bar chart. Under-counting visibly is strictly better than
 *      misattributing types, and the gap is surfaced via the
 *      `restrictedContributionsCount` banner.
 */
export function buildFounderTypedCalendar(contrib: ContributionsInput): TypedDayCounts {
  const typed: TypedDayCounts = {}

  for (const repo of contrib.commitContributionsByRepository ?? []) {
    if (!repo?.contributions?.nodes) continue
    for (const node of repo.contributions.nodes) {
      if (!node?.occurredAt) continue
      const date = node.occurredAt.slice(0, 10)
      typed[date] ??= { commits: 0, prs: 0, issues: 0 }
      typed[date].commits += node.commitCount ?? 0
    }
  }

  for (const node of contrib.pullRequestContributions?.nodes ?? []) {
    if (!node?.occurredAt) continue
    const date = node.occurredAt.slice(0, 10)
    typed[date] ??= { commits: 0, prs: 0, issues: 0 }
    typed[date].prs += 1
  }

  for (const node of contrib.issueContributions?.nodes ?? []) {
    if (!node?.occurredAt) continue
    const date = node.occurredAt.slice(0, 10)
    typed[date] ??= { commits: 0, prs: 0, issues: 0 }
    typed[date].issues += 1
  }

  return typed
}
