import { v } from 'convex/values'
import { internalMutation } from '../functions'
import {
  computeBaseline,
  planSessionTrim,
  type DayCount,
  type SessionGroup,
} from '../lib/scrubMath'
import type { Doc, Id } from '../_generated/dataModel'

/**
 * One-off migration: scrub inflated session spikes from a tracker website
 * by deleting the heaviest sessionId clusters down to a baseline computed
 * from the surrounding week, then directly upserting the daily metricsData
 * snapshots so the leaderboard reflects the corrected counts.
 *
 * Why direct metricsData upserts: the rollup cron (fetchTrackerMetrics_cron)
 * only writes buckets for days that have events. If we delete every event
 * on a spike day, the cron leaves the stale inflated metricsData row in
 * place. Patching directly here sidesteps that latent bug for the days we
 * touch. The bug itself is tracked separately in TODOS.md.
 *
 * Idempotent: re-running on cleaned data is a no-op (current count <=
 * baseline → empty trim plan).
 *
 * Run dry-run on prod first (args is a positional, no --args flag):
 *   npx convex run --prod migrations/scrubRedefineMeSpikes:run \
 *     '{"websiteName":"redefine me","spikeDates":["2026-04-17","2026-04-19"],"dryRun":true}'
 *
 * Then for real:
 *   npx convex run --prod migrations/scrubRedefineMeSpikes:run \
 *     '{"websiteName":"redefine me","spikeDates":["2026-04-17","2026-04-19"]}'
 */
export const run = internalMutation({
  args: {
    websiteName: v.string(),
    spikeDates: v.array(v.string()),
    /** Look-back window for baseline mean. Default 7 days. */
    windowDays: v.optional(v.number()),
    /** When true, prints the plan and makes no writes. */
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false
    const windowDays = args.windowDays ?? 7

    // ── Validate spike-date input ───────────────────────────────────
    if (args.spikeDates.length === 0) {
      throw new Error('spikeDates must not be empty')
    }
    const dedupedSpikes = Array.from(new Set(args.spikeDates))
    if (dedupedSpikes.length !== args.spikeDates.length) {
      throw new Error(
        `spikeDates contains duplicates: ${args.spikeDates.join(',')} — refusing to run`
      )
    }
    for (const d of dedupedSpikes) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        throw new Error(`spikeDate "${d}" must be UTC YYYY-MM-DD`)
      }
    }

    // ── Find the website (refuse if 0 or >1 match by name) ──────────
    const websites = await ctx.db.query('trackerWebsites').collect()
    const matches = websites.filter(
      (w) => w.name.trim().toLowerCase() === args.websiteName.trim().toLowerCase()
    )
    if (matches.length === 0) {
      throw new Error(`No tracker website matches name "${args.websiteName}"`)
    }
    if (matches.length > 1) {
      throw new Error(
        `Multiple tracker websites match "${args.websiteName}" — refusing to guess. Matched _ids: ${matches
          .map((w) => w._id)
          .join(', ')}`
      )
    }
    const website = matches[0]

    // ── Pull the lookback window's worth of events once ─────────────
    // Find the earliest spike date and walk back `windowDays` more.
    const sortedSpikes = [...dedupedSpikes].sort()
    const earliestSpike = parseUtcDay(sortedSpikes[0])
    const latestSpike = parseUtcDay(sortedSpikes[sortedSpikes.length - 1])
    const lookbackStartMs = earliestSpike.getTime() - windowDays * 86_400_000
    const lookbackEndMs = latestSpike.getTime() + 86_400_000 // include the latest spike day

    // Convex per-mutation read budget is finite. Bail before .collect()
    // if the table is too large to safely scan in one transaction.
    // Pragmatic cap: the redefine-me scrub processes ~3-5k events; 8k is
    // well under Convex's typical mutation read ceiling.
    const MAX_EVENTS_PER_RUN = 8_000
    const allEvents: Array<Doc<'trackerEvents'>> = await ctx.db
      .query('trackerEvents')
      .withIndex('by_websiteId', (q) => q.eq('websiteId', website._id))
      .collect()
    if (allEvents.length > MAX_EVENTS_PER_RUN) {
      throw new Error(
        `Website "${website.name}" has ${allEvents.length} events (cap ${MAX_EVENTS_PER_RUN}). ` +
          `This migration is one-shot and not safe at this scale. Refactor to paginate before re-running.`
      )
    }
    const inWindow = allEvents.filter(
      (e) => e._creationTime >= lookbackStartMs && e._creationTime < lookbackEndMs
    )

    // ── Build day → unique session count map for baseline computation
    // Events without a sessionId are dropped from the count entirely (rather
    // than synthesized as one-event sessions). Pre-anti-gaming events are
    // the main source — counting them as fake sessions would inflate the
    // current-day count and over-trigger deletes.
    const dayCountsMap = new Map<string, Set<string>>()
    for (const event of inWindow) {
      if (!event.sessionId) continue
      const day = utcDayOf(event._creationTime)
      const set = dayCountsMap.get(day) ?? new Set<string>()
      set.add(event.sessionId)
      dayCountsMap.set(day, set)
    }
    const dayCounts: DayCount[] = Array.from(dayCountsMap.entries()).map(([date, sids]) => ({
      date,
      count: sids.size,
    }))

    // ── Per-spike planning ──────────────────────────────────────────
    interface SpikePlan {
      spikeDate: string
      currentSessions: number
      baseline: number | null
      insufficientReason?: 'no_window' | 'too_sparse'
      sessionIdsToDelete: string[]
      eventsToDelete: number
      remainingSessions: number
    }
    const plans: SpikePlan[] = []

    for (const spikeDate of sortedSpikes) {
      const startMs = parseUtcDay(spikeDate).getTime()
      const endMs = startMs + 86_400_000
      const dayEvents = inWindow.filter(
        (e) => e._creationTime >= startMs && e._creationTime < endMs
      )

      // Group by sessionId. Drop events without a sessionId — they predate
      // anti-gaming and aren't part of the bot inflation pattern.
      const groupMap = new Map<string, number>()
      for (const event of dayEvents) {
        if (!event.sessionId) continue
        groupMap.set(event.sessionId, (groupMap.get(event.sessionId) ?? 0) + 1)
      }
      const sessionGroups: SessionGroup[] = Array.from(groupMap.entries()).map(
        ([sessionId, eventCount]) => ({ sessionId, eventCount })
      )

      const otherSpikeDates = sortedSpikes.filter((d) => d !== spikeDate)
      const baselineRes = computeBaseline({
        dayCounts,
        spikeDate,
        otherSpikeDates,
        windowDays,
      })
      const trim = planSessionTrim({
        sessionGroups,
        baseline: baselineRes.baseline,
      })

      plans.push({
        spikeDate,
        currentSessions: sessionGroups.length,
        baseline: baselineRes.baseline,
        insufficientReason: baselineRes.insufficientReason,
        sessionIdsToDelete: trim.sessionIdsToDelete,
        eventsToDelete: trim.eventsToDelete,
        remainingSessions: trim.remainingSessions,
      })
    }

    console.log(
      `scrubRedefineMeSpikes: website "${website.name}" (_id: ${website._id})\nplan:\n` +
        plans
          .map((p) => {
            if (p.baseline === null) {
              return (
                `  ${p.spikeDate}: REFUSING — baseline insufficient (${p.insufficientReason}). ` +
                `current=${p.currentSessions}, no delete planned. ` +
                `Widen the window or add more spike dates and re-run.`
              )
            }
            return (
              `  ${p.spikeDate}: current=${p.currentSessions}, baseline=${p.baseline}, ` +
              `delete ${p.sessionIdsToDelete.length} clusters [${p.sessionIdsToDelete
                .slice(0, 5)
                .join(',')}${p.sessionIdsToDelete.length > 5 ? ',...' : ''}] ` +
              `/ ${p.eventsToDelete} events, remaining=${p.remainingSessions}`
            )
          })
          .join('\n')
    )

    if (dryRun) {
      return { dryRun: true, websiteId: website._id, plans }
    }

    // Refuse to execute if any spike has insufficient baseline. Operator
    // has to widen the window or split the run.
    const refused = plans.filter((p) => p.baseline === null)
    if (refused.length > 0) {
      throw new Error(
        `Refusing to execute: ${refused.length} spike(s) have insufficient baseline ` +
          `(${refused.map((p) => `${p.spikeDate}:${p.insufficientReason}`).join(', ')}). ` +
          `Re-run dry-run with a wider windowDays or add the right spikeDates.`
      )
    }

    // ── Execute ─────────────────────────────────────────────────────
    let totalDeleted = 0
    for (const plan of plans) {
      const startMs = parseUtcDay(plan.spikeDate).getTime()
      const endMs = startMs + 86_400_000
      const deleteSet = new Set(plan.sessionIdsToDelete)

      const dayEvents = inWindow.filter(
        (e) => e._creationTime >= startMs && e._creationTime < endMs
      )
      for (const event of dayEvents) {
        if (event.sessionId && deleteSet.has(event.sessionId)) {
          await ctx.db.delete(event._id)
          totalDeleted++
        }
      }

      // ── Direct metricsData upsert for this spike day ──────────────
      // Recompute pageviews + sessions from surviving events on this day.
      const surviving = dayEvents.filter((e) => !(e.sessionId && deleteSet.has(e.sessionId)))
      const survivingSessions = new Set(
        surviving.map((e) => e.sessionId).filter((s): s is string => Boolean(s))
      )
      const survivingPageviews = surviving.filter((e) => !e.eventName).length
      const dayTs = `${plan.spikeDate}T00:00:00.000Z`

      await upsertMetric(ctx, {
        startupId: website.startupId,
        metricKey: 'sessions',
        value: survivingSessions.size,
        timestamp: dayTs,
      })
      await upsertMetric(ctx, {
        startupId: website.startupId,
        metricKey: 'pageviews',
        value: survivingPageviews,
        timestamp: dayTs,
      })
      await upsertMetric(ctx, {
        startupId: website.startupId,
        metricKey: 'weekly_active_users',
        value: survivingSessions.size,
        timestamp: dayTs,
      })
    }

    console.log(
      `scrubRedefineMeSpikes: deleted ${totalDeleted} events across ${plans.length} spike day(s); patched metricsData per day.`
    )
    return { dryRun: false, websiteId: website._id, plans, totalDeleted }
  },
})

async function upsertMetric(
  ctx: { db: any },
  args: {
    startupId: Id<'startups'>
    metricKey: string
    value: number
    timestamp: string
  }
): Promise<void> {
  const existing = await ctx.db
    .query('metricsData')
    .withIndex('by_startupId_provider_metricKey', (q: any) =>
      q.eq('startupId', args.startupId).eq('provider', 'tracker').eq('metricKey', args.metricKey)
    )
    .filter((q: any) => q.eq(q.field('timestamp'), args.timestamp))
    .first()

  if (existing) {
    await ctx.db.patch(existing._id, { value: args.value })
  } else {
    await ctx.db.insert('metricsData', {
      startupId: args.startupId,
      provider: 'tracker',
      metricKey: args.metricKey,
      value: args.value,
      timestamp: args.timestamp,
      window: 'daily',
    })
  }
}

function parseUtcDay(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) throw new Error(`invalid UTC day: ${s}`)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

function utcDayOf(epochMs: number): string {
  const d = new Date(epochMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
