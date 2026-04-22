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
 * Run dry-run on prod first:
 *   npx convex run --prod migrations/scrubRedefineMeSpikes:run --args \
 *     '{"websiteName":"redefine me","spikeDates":["2026-04-17","2026-04-19"],"dryRun":true}'
 *
 * Then for real:
 *   npx convex run --prod migrations/scrubRedefineMeSpikes:run --args \
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
    const sortedSpikes = [...args.spikeDates].sort()
    const earliestSpike = parseUtcDay(sortedSpikes[0])
    const latestSpike = parseUtcDay(sortedSpikes[sortedSpikes.length - 1])
    const lookbackStartMs = earliestSpike.getTime() - windowDays * 86_400_000
    const lookbackEndMs = latestSpike.getTime() + 86_400_000 // include the latest spike day

    const allEvents: Array<Doc<'trackerEvents'>> = await ctx.db
      .query('trackerEvents')
      .withIndex('by_websiteId', (q) => q.eq('websiteId', website._id))
      .collect()
    const inWindow = allEvents.filter(
      (e) => e._creationTime >= lookbackStartMs && e._creationTime < lookbackEndMs
    )

    // ── Build day → unique session count map for baseline computation
    const dayCountsMap = new Map<string, Set<string>>()
    for (const event of inWindow) {
      const day = utcDayOf(event._creationTime)
      const sid = event.sessionId ?? `_no_session_${event._id}`
      const set = dayCountsMap.get(day) ?? new Set<string>()
      set.add(sid)
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
      baseline: number
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

      // Group by sessionId to compute clusters.
      const groupMap = new Map<string, number>()
      for (const event of dayEvents) {
        const sid = event.sessionId ?? `_no_session_${event._id}`
        groupMap.set(sid, (groupMap.get(sid) ?? 0) + 1)
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
        sessionIdsToDelete: trim.sessionIdsToDelete,
        eventsToDelete: trim.eventsToDelete,
        remainingSessions: trim.remainingSessions,
      })
    }

    console.log(
      `scrubRedefineMeSpikes: website "${website.name}" (_id: ${website._id})\nplan:\n` +
        plans
          .map(
            (p) =>
              `  ${p.spikeDate}: current=${p.currentSessions}, baseline=${p.baseline}, ` +
              `delete ${p.sessionIdsToDelete.length} clusters / ${p.eventsToDelete} events, remaining=${p.remainingSessions}`
          )
          .join('\n')
    )

    if (dryRun) {
      return { dryRun: true, websiteId: website._id, plans }
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
        const sid = event.sessionId ?? `_no_session_${event._id}`
        if (deleteSet.has(sid)) {
          await ctx.db.delete(event._id)
          totalDeleted++
        }
      }

      // ── Direct metricsData upsert for this spike day ──────────────
      // Recompute pageviews + sessions from surviving events on this day.
      const surviving = dayEvents.filter((e) => {
        const sid = e.sessionId ?? `_no_session_${e._id}`
        return !deleteSet.has(sid)
      })
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
