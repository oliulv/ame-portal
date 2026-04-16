import { query, mutation } from './functions'
import { v } from 'convex/values'
import { requireAdmin, requireAuth, requireSuperAdmin } from './auth'
import type { Doc, Id } from './_generated/dataModel'
import { getWeekBoundaries } from './lib/dateUtils'
import {
  WEIGHTS as SCORING_WEIGHTS,
  ROLLING_WEEKS,
  QUALIFICATION_THRESHOLD,
  DECAY_RATE,
  computeConsistencyBonus,
  computeUpdateScore,
  computeVelocityScore,
  convertMergedCalendar,
  type TypedDayCounts,
  type MergedCalendarWeek,
} from './lib/scoring'
import { computeStreak } from './lib/streak'

// Legacy weights map including social at 0 for backward compatibility
// The shared scoring lib uses 5-category weights; this map keeps old code paths working
// while social scores contribute 0 to the total.
const WEIGHTS = {
  ...SCORING_WEIGHTS,
  social: 0,
} as const

// Legacy constants and helpers used by the existing scoring code.
// These will be removed when the full dedup refactor replaces inline scoring
// with calls to computeStartupScore from the shared lib.
const MAX_CAP = 100 // Score range is 0-100 in UI (0-1 internally)
const QUALIFICATION_GATE = QUALIFICATION_THRESHOLD

function temporalDecay(daysOld: number): number {
  return Math.exp(-DECAY_RATE * daysOld)
}

function powerLawNormalize(values: number[], p: number): number[] {
  if (values.length === 0) return []
  const transformed = values.map((v) => Math.pow(1 + Math.max(0, v), p))
  const maxVal = Math.max(...transformed)
  if (maxVal === 0) return values.map(() => 0)
  return transformed.map((t) => (t / maxVal) * 100)
}

// ── Score Breakdown Type ─────────────────────────────────────────────

export interface ScoreBreakdown {
  startupId: Id<'startups'>
  startupName: string
  startupSlug?: string
  startupLogoUrl?: string
  rank: number | null // null = unranked
  totalScore: number
  categories: {
    revenue: { raw: number; normalized: number; weighted: number }
    traffic: { raw: number; normalized: number; weighted: number }
    github: { raw: number; normalized: number; weighted: number }
    updates: { raw: number; normalized: number; weighted: number }
    milestones: { raw: number; normalized: number; weighted: number }
  }
  activeCategories: number
  qualified: boolean
  consistencyBonus: number
  rankChange: number | null // positive = moved up, negative = moved down, null = no prior data
  isFavoriteThisWeek: boolean
  favoriteMultiplier: number
  updateStreak: number
  excludeFromMetrics: boolean
}

/**
 * Read the velocity calendar for a startup (typed → fallback to merged).
 * Single source of truth for velocity scoring across all consumers.
 */
async function readVelocityCalendar(
  ctx: { db: any },
  startupId: Id<'startups'>
): Promise<TypedDayCounts> {
  const typedMetric = await ctx.db
    .query('metricsData')
    .withIndex('by_startupId_provider_metricKey', (q: any) =>
      q
        .eq('startupId', startupId)
        .eq('provider', 'github')
        .eq('metricKey', 'typed_contribution_calendar')
    )
    .order('desc')
    .first()

  const typed = (typedMetric?.meta as TypedDayCounts | undefined) ?? {}
  if (Object.keys(typed).length > 0) return typed

  // Fallback: merged contribution calendar
  const mergedMetric = await ctx.db
    .query('metricsData')
    .withIndex('by_startupId_provider_metricKey', (q: any) =>
      q.eq('startupId', startupId).eq('provider', 'github').eq('metricKey', 'contribution_calendar')
    )
    .order('desc')
    .first()

  const merged = mergedMetric?.meta as MergedCalendarWeek[] | undefined
  if (merged && merged.length > 0) return convertMergedCalendar(merged)

  return {}
}

// ── Main Leaderboard Query ───────────────────────────────────────────

/**
 * Compute the full leaderboard for a cohort.
 * All scoring is done on-read from raw data.
 */
export const computeLeaderboard = query({
  args: {
    cohortId: v.id('cohorts'),
    weekOf: v.optional(v.string()), // Optional: specific week to score
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const cohort = await ctx.db.get(args.cohortId)
    if (!cohort) throw new Error('Cohort not found')

    const p = cohort.leaderboardConfig?.normalizationPower ?? 0.7

    // Get all startups
    const startups = await ctx.db
      .query('startups')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', args.cohortId))
      .collect()

    const weeks = getWeekBoundaries(ROLLING_WEEKS + 1) // +1 for prev-week lookback
    const now = new Date()

    // Collect raw scores per startup per category
    const rawScores: Map<
      string,
      {
        startup: Doc<'startups'>
        weeklyMrrGrowth: number[]
        weeklyTraffic: number[]
        weeklyGithub: number[]
        weeklySocial: number[]
        totalMrrGrowth: number
        totalTraffic: number
        totalGithub: number
        totalSocial: number
        updatesScore: number
        updateStreak: number
        milestonesScore: number
        isFavoriteThisWeek: boolean
        anomalies: Array<{ category: string; value: number; threshold: number }>
      }
    > = new Map()

    for (const startup of startups) {
      // ── Revenue Growth (WoW MRR % change) ───────────────────
      const customerMrrs = await ctx.db
        .query('customerMrr')
        .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
        .collect()

      // Group MRR by month
      const monthlyMrr = new Map<string, number>()
      for (const row of customerMrrs) {
        monthlyMrr.set(row.month, (monthlyMrr.get(row.month) ?? 0) + row.mrr)
      }

      // Get weekly MRR snapshots from metricsData
      const mrrMetrics = await ctx.db
        .query('metricsData')
        .withIndex('by_startupId_provider_metricKey', (q) =>
          q.eq('startupId', startup._id).eq('provider', 'stripe').eq('metricKey', 'mrr')
        )
        .collect()

      const weeklyMrrGrowth: number[] = []
      for (let i = 0; i < weeks.length; i++) {
        const week = weeks[i]
        const prevWeek = weeks[i + 1]
        // Find MRR at start and end of week
        const thisWeekMrr =
          mrrMetrics
            .filter(
              (m) => m.timestamp >= week.start.toISOString() && m.timestamp < week.end.toISOString()
            )
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.value ?? 0

        const prevWeekMrr = prevWeek
          ? (mrrMetrics
              .filter(
                (m) =>
                  m.timestamp >= prevWeek.start.toISOString() &&
                  m.timestamp < prevWeek.end.toISOString()
              )
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.value ?? 0)
          : 0

        const growthPct = prevWeekMrr > 0 ? ((thisWeekMrr - prevWeekMrr) / prevWeekMrr) * 100 : 0
        weeklyMrrGrowth.push(growthPct)
      }

      // ── Traffic Growth (WoW session % change) ────────────────
      const sessionMetrics = await ctx.db
        .query('metricsData')
        .withIndex('by_startupId_provider_metricKey', (q) =>
          q.eq('startupId', startup._id).eq('provider', 'tracker').eq('metricKey', 'sessions')
        )
        .collect()

      const weeklyTraffic: number[] = []
      for (let i = 0; i < weeks.length; i++) {
        const week = weeks[i]
        const prevWeek = weeks[i + 1]
        const thisWeekSessions = sessionMetrics
          .filter(
            (m) => m.timestamp >= week.start.toISOString() && m.timestamp < week.end.toISOString()
          )
          .reduce((sum, m) => sum + m.value, 0)

        const prevWeekSessions = prevWeek
          ? sessionMetrics
              .filter(
                (m) =>
                  m.timestamp >= prevWeek.start.toISOString() &&
                  m.timestamp < prevWeek.end.toISOString()
              )
              .reduce((sum, m) => sum + m.value, 0)
          : 0

        const growthPct =
          prevWeekSessions > 0
            ? ((thisWeekSessions - prevWeekSessions) / prevWeekSessions) * 100
            : 0
        weeklyTraffic.push(growthPct)
      }

      // ── GitHub Activity (compute from calendar — single source of truth) ─
      const velocityCalendar = await readVelocityCalendar(ctx, startup._id)
      const weeklyGithub: number[] = []
      for (const week of weeks) {
        weeklyGithub.push(computeVelocityScore(velocityCalendar, week.end))
      }

      // ── Social Growth (follower growth %) ────────────────────
      const socialFollowers = await ctx.db
        .query('metricsData')
        .withIndex('by_startupId_provider_metricKey', (q) =>
          q
            .eq('startupId', startup._id)
            .eq('provider', 'apify')
            .eq('metricKey', 'twitter_followers')
        )
        .collect()

      // Also try linkedin and instagram
      const linkedinFollowers = await ctx.db
        .query('metricsData')
        .withIndex('by_startupId_provider_metricKey', (q) =>
          q
            .eq('startupId', startup._id)
            .eq('provider', 'apify')
            .eq('metricKey', 'linkedin_followers')
        )
        .collect()

      const allSocialMetrics = [...socialFollowers, ...linkedinFollowers]
      const weeklySocial: number[] = []
      for (let i = 0; i < weeks.length; i++) {
        const week = weeks[i]
        const prevWeek = weeks[i + 1]
        const thisWeekFollowers =
          allSocialMetrics
            .filter(
              (m) => m.timestamp >= week.start.toISOString() && m.timestamp < week.end.toISOString()
            )
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.value ?? 0
        const prevWeekFollowers = prevWeek
          ? (allSocialMetrics
              .filter(
                (m) =>
                  m.timestamp >= prevWeek.start.toISOString() &&
                  m.timestamp < prevWeek.end.toISOString()
              )
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.value ?? 0)
          : 0
        const growthPct =
          prevWeekFollowers > 0
            ? ((thisWeekFollowers - prevWeekFollowers) / prevWeekFollowers) * 100
            : 0
        weeklySocial.push(growthPct)
      }

      // ── Weekly Updates Score ──────────────────────────────────
      const weeklyUpdates = await ctx.db
        .query('weeklyUpdates')
        .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
        .collect()

      let updatesScore = 0
      const streak = computeStreak(weeklyUpdates, now)
      const isFavoriteThisWeek = weeklyUpdates.some(
        (u) => u.weekOf === weeks[0].weekOf && u.isFavorite
      )

      // Base 10 points per submitted week, scaled by the shared
      // computeUpdateScore helper (1.0 → +0%, 1.8 → +80% at an 8-week streak).
      const weekBase = computeUpdateScore(true, streak) * 10

      for (const week of weeks) {
        const update = weeklyUpdates.find((u) => u.weekOf === week.weekOf)
        if (update) {
          let weekPoints = weekBase
          if (update.isFavorite) weekPoints += 25

          const daysOld = (now.getTime() - week.start.getTime()) / (1000 * 60 * 60 * 24)
          updatesScore += weekPoints * temporalDecay(daysOld)
        }
      }

      // ── Milestones Score ──────────────────────────────────────
      const milestones = await ctx.db
        .query('milestones')
        .withIndex('by_startupId', (q) => q.eq('startupId', startup._id))
        .collect()

      const totalMilestones = milestones.length
      const approvedMilestones = milestones.filter((m) => m.status === 'approved').length
      const milestonesScore = totalMilestones > 0 ? (approvedMilestones / totalMilestones) * 100 : 0

      // ── Apply temporal decay to weekly scores ─────────────────
      let totalMrrGrowth = 0
      let totalTraffic = 0
      let totalGithub = 0
      let totalSocial = 0

      for (let i = 0; i < weeks.length; i++) {
        const daysOld = (now.getTime() - weeks[i].start.getTime()) / (1000 * 60 * 60 * 24)
        const decay = temporalDecay(daysOld)
        totalMrrGrowth += weeklyMrrGrowth[i] * decay
        totalTraffic += weeklyTraffic[i] * decay
        totalSocial += weeklySocial[i] * decay
      }
      // computeVelocityScore already includes 28-day decay — use latest directly
      totalGithub = weeklyGithub[0] ?? 0

      // ── Anomaly detection ─────────────────────────────────────
      const anomalies: Array<{ category: string; value: number; threshold: number }> = []
      const checkAnomaly = (name: string, values: number[]) => {
        const valid = values.filter((v) => v !== 0)
        if (valid.length < 3) return
        const mean = valid.reduce((a, b) => a + b, 0) / valid.length
        const stdDev = Math.sqrt(
          valid.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / valid.length
        )
        const latest = values[0]
        if (latest > mean + 2 * stdDev) {
          anomalies.push({ category: name, value: latest, threshold: mean + 2 * stdDev })
        }
      }
      checkAnomaly('revenue', weeklyMrrGrowth)
      checkAnomaly('traffic', weeklyTraffic)
      checkAnomaly('github', weeklyGithub)
      checkAnomaly('social', weeklySocial)

      rawScores.set(startup._id, {
        startup,
        weeklyMrrGrowth,
        weeklyTraffic,
        weeklyGithub,
        weeklySocial,
        totalMrrGrowth,
        totalTraffic,
        totalGithub,
        totalSocial,
        updatesScore,
        updateStreak: streak,
        milestonesScore,
        isFavoriteThisWeek,
        anomalies,
      })
    }

    // ── Power law normalization for unbounded metrics ────────────
    const revenueValues = Array.from(rawScores.values()).map((s) => s.totalMrrGrowth)
    const trafficValues = Array.from(rawScores.values()).map((s) => s.totalTraffic)
    const githubValues = Array.from(rawScores.values()).map((s) => s.totalGithub)
    const socialValues = Array.from(rawScores.values()).map((s) => s.totalSocial)

    const normalizedRevenue = powerLawNormalize(revenueValues, p)
    const normalizedTraffic = powerLawNormalize(trafficValues, p)
    const normalizedGithub = powerLawNormalize(githubValues, p)
    const normalizedSocial = powerLawNormalize(socialValues, p)

    // ── Build final scores ──────────────────────────────────────
    const entries = Array.from(rawScores.entries())
    const results: ScoreBreakdown[] = []

    for (let idx = 0; idx < entries.length; idx++) {
      const [startupId, data] = entries[idx]

      // Apply 40% cap
      const cappedRevenue = Math.min(normalizedRevenue[idx], MAX_CAP)
      const cappedTraffic = Math.min(normalizedTraffic[idx], MAX_CAP)
      const cappedGithub = Math.min(normalizedGithub[idx], MAX_CAP)
      const cappedSocial = Math.min(normalizedSocial[idx], MAX_CAP)
      const cappedUpdates = Math.min(data.updatesScore, MAX_CAP)
      const cappedMilestones = Math.min(data.milestonesScore, MAX_CAP)

      // Apply weights
      const weightedRevenue = cappedRevenue * WEIGHTS.revenue
      const weightedTraffic = cappedTraffic * WEIGHTS.traffic
      const weightedGithub = cappedGithub * WEIGHTS.github
      const weightedSocial = cappedSocial * WEIGHTS.social
      const weightedUpdates = cappedUpdates * WEIGHTS.updates
      const weightedMilestones = cappedMilestones * WEIGHTS.milestones

      let totalScore =
        weightedRevenue +
        weightedTraffic +
        weightedGithub +
        weightedSocial +
        weightedUpdates +
        weightedMilestones

      // Count active categories (non-zero) — 5 categories, no social
      const activeCategories = [
        data.totalMrrGrowth,
        data.totalTraffic,
        data.totalGithub,
        data.updatesScore,
        data.milestonesScore,
      ].filter((v) => v > 0).length

      const qualified = activeCategories >= QUALIFICATION_THRESHOLD

      // Consistency bonus — compute per-week composite scores (not flat array)
      const weeklyComposites: number[] = []
      for (let w = 0; w < weeks.length; w++) {
        weeklyComposites.push(
          Math.abs(data.weeklyMrrGrowth[w] ?? 0) +
            Math.abs(data.weeklyTraffic[w] ?? 0) +
            Math.abs(data.weeklyGithub[w] ?? 0)
        )
      }
      const consistencyBonus = computeConsistencyBonus(weeklyComposites)
      totalScore *= 1 + consistencyBonus / 100

      // Admin favorite multiplier
      const favoriteMultiplier = data.isFavoriteThisWeek ? 1.25 : 1
      totalScore *= favoriteMultiplier

      results.push({
        startupId: startupId as Id<'startups'>,
        startupName: data.startup.name,
        startupSlug: data.startup.slug,
        startupLogoUrl: data.startup.logoUrl,
        rank: null,
        totalScore: Math.round(totalScore * 100) / 100,
        categories: {
          revenue: {
            raw: data.totalMrrGrowth,
            normalized: normalizedRevenue[idx],
            weighted: weightedRevenue,
          },
          traffic: {
            raw: data.totalTraffic,
            normalized: normalizedTraffic[idx],
            weighted: weightedTraffic,
          },
          github: {
            raw: data.totalGithub,
            normalized: normalizedGithub[idx],
            weighted: weightedGithub,
          },
          updates: {
            raw: data.updatesScore,
            normalized: data.updatesScore,
            weighted: weightedUpdates,
          },
          milestones: {
            raw: data.milestonesScore,
            normalized: data.milestonesScore,
            weighted: weightedMilestones,
          },
        },
        activeCategories,
        qualified,
        consistencyBonus,
        rankChange: null, // computed after ranking
        isFavoriteThisWeek: data.isFavoriteThisWeek,
        favoriteMultiplier,
        updateStreak: data.updateStreak,
        excludeFromMetrics: data.startup.excludeFromMetrics === true,
      })
    }

    // ── Rank qualified startups ─────────────────────────────────
    const ranked = results
      .filter((r) => r.qualified && !r.excludeFromMetrics)
      .sort((a, b) => b.totalScore - a.totalScore)

    ranked.forEach((r, i) => {
      r.rank = i + 1
    })

    // ── Compute rank changes (compare to last week's ranking) ──
    // Re-score using previous week's data (shift weekly arrays by 1)
    const prevScores: Array<{ startupId: Id<'startups'>; score: number }> = []
    for (const [, data] of rawScores) {
      let prevMrr = 0
      let prevTraffic = 0
      let prevSocial = 0
      for (let i = 1; i < weeks.length; i++) {
        const daysOld = (now.getTime() - weeks[i].start.getTime()) / (1000 * 60 * 60 * 24)
        const decay = temporalDecay(daysOld)
        prevMrr += data.weeklyMrrGrowth[i] * decay
        prevTraffic += data.weeklyTraffic[i] * decay
        prevSocial += data.weeklySocial[i] * decay
      }
      const prevGithub = data.weeklyGithub[1] ?? 0
      prevScores.push({
        startupId: data.startup._id,
        score: prevMrr + prevTraffic + prevGithub + prevSocial,
      })
    }
    prevScores.sort((a, b) => b.score - a.score)
    const prevRankMap = new Map(prevScores.map((s, i) => [s.startupId, i + 1]))

    for (const r of ranked) {
      const prev = prevRankMap.get(r.startupId)
      if (prev != null && r.rank != null) {
        r.rankChange = prev - r.rank // positive = moved up
      }
    }

    const unranked = results.filter((r) => !r.qualified || r.excludeFromMetrics)

    return { ranked, unranked, normalizationPower: p }
  },
})

/**
 * Compute leaderboard visible to founders (for their cohort).
 * Same scoring logic, but accessed via requireAuth instead of requireAdmin.
 */
export const computeLeaderboardForFounder = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx)

    // Get founder's startup to determine their cohort
    const founderProfile = await ctx.db
      .query('founderProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .first()

    if (!founderProfile) return null

    const startup = await ctx.db.get(founderProfile.startupId)
    if (!startup) return null

    const cohort = await ctx.db.get(startup.cohortId)
    if (!cohort) return null

    // Reuse the same computation (we duplicate it here to avoid circular deps)
    // In practice, we call the admin version with the cohort ID
    const p = cohort.leaderboardConfig?.normalizationPower ?? 0.7

    const startups = await ctx.db
      .query('startups')
      .withIndex('by_cohortId', (q) => q.eq('cohortId', startup.cohortId))
      .collect()

    const weeks = getWeekBoundaries(ROLLING_WEEKS + 1) // +1 for prev-week lookback
    const now = new Date()

    // Simplified scoring for founder view - compute same metrics
    const results: Array<{
      startupId: Id<'startups'>
      startupName: string
      startupSlug?: string
      startupLogoUrl?: string
      rank: number | null
      totalScore: number
      activeCategories: number
      qualified: boolean
      rankChange: number | null
      isFavoriteThisWeek: boolean
      updateStreak: number
      excludeFromMetrics: boolean
    }> = []

    // Collect raw unbounded scores for normalization
    const rawData: Array<{
      startup: Doc<'startups'>
      weeklyMrrGrowth: number[]
      weeklyTraffic: number[]
      weeklyGithub: number[]
      totalMrrGrowth: number
      totalTraffic: number
      totalGithub: number
      totalSocial: number
      updatesScore: number
      updateStreak: number
      milestonesScore: number
      isFavoriteThisWeek: boolean
    }> = []

    for (const s of startups) {
      // Revenue
      const mrrMetrics = await ctx.db
        .query('metricsData')
        .withIndex('by_startupId_provider_metricKey', (q) =>
          q.eq('startupId', s._id).eq('provider', 'stripe').eq('metricKey', 'mrr')
        )
        .collect()

      let totalMrrGrowth = 0
      const weeklyMrrGrowth: number[] = []
      for (let i = 0; i < weeks.length; i++) {
        const week = weeks[i]
        const prevWeek = weeks[i + 1]
        const thisVal =
          mrrMetrics
            .filter(
              (m) => m.timestamp >= week.start.toISOString() && m.timestamp < week.end.toISOString()
            )
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.value ?? 0
        const prevVal = prevWeek
          ? (mrrMetrics
              .filter(
                (m) =>
                  m.timestamp >= prevWeek.start.toISOString() &&
                  m.timestamp < prevWeek.end.toISOString()
              )
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.value ?? 0)
          : 0
        const growth = prevVal > 0 ? ((thisVal - prevVal) / prevVal) * 100 : 0
        weeklyMrrGrowth.push(growth)
        const daysOld = (now.getTime() - week.start.getTime()) / (1000 * 60 * 60 * 24)
        totalMrrGrowth += growth * temporalDecay(daysOld)
      }

      // Traffic
      const sessionMetrics = await ctx.db
        .query('metricsData')
        .withIndex('by_startupId_provider_metricKey', (q) =>
          q.eq('startupId', s._id).eq('provider', 'tracker').eq('metricKey', 'sessions')
        )
        .collect()
      let totalTraffic = 0
      const weeklyTraffic: number[] = []
      for (let i = 0; i < weeks.length; i++) {
        const week = weeks[i]
        const prevWeek = weeks[i + 1]
        const thisVal = sessionMetrics
          .filter(
            (m) => m.timestamp >= week.start.toISOString() && m.timestamp < week.end.toISOString()
          )
          .reduce((s, m) => s + m.value, 0)
        const prevVal = prevWeek
          ? sessionMetrics
              .filter(
                (m) =>
                  m.timestamp >= prevWeek.start.toISOString() &&
                  m.timestamp < prevWeek.end.toISOString()
              )
              .reduce((s, m) => s + m.value, 0)
          : 0
        const growth = prevVal > 0 ? ((thisVal - prevVal) / prevVal) * 100 : 0
        weeklyTraffic.push(growth)
        const daysOld = (now.getTime() - week.start.getTime()) / (1000 * 60 * 60 * 24)
        totalTraffic += growth * temporalDecay(daysOld)
      }

      // GitHub (compute from calendar — single source of truth)
      const velocityCalendar = await readVelocityCalendar(ctx, s._id)
      const weeklyGithub: number[] = []
      for (const week of weeks) {
        weeklyGithub.push(computeVelocityScore(velocityCalendar, week.end))
      }
      const totalGithub = weeklyGithub[0] ?? 0

      // Social
      const socialMetrics = await ctx.db
        .query('metricsData')
        .withIndex('by_startupId_provider_metricKey', (q) =>
          q.eq('startupId', s._id).eq('provider', 'apify').eq('metricKey', 'twitter_followers')
        )
        .collect()
      let totalSocial = 0
      for (let i = 0; i < weeks.length; i++) {
        const week = weeks[i]
        const prevWeek = weeks[i + 1]
        const thisVal =
          socialMetrics
            .filter(
              (m) => m.timestamp >= week.start.toISOString() && m.timestamp < week.end.toISOString()
            )
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.value ?? 0
        const prevVal = prevWeek
          ? (socialMetrics
              .filter(
                (m) =>
                  m.timestamp >= prevWeek.start.toISOString() &&
                  m.timestamp < prevWeek.end.toISOString()
              )
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.value ?? 0)
          : 0
        const growth = prevVal > 0 ? ((thisVal - prevVal) / prevVal) * 100 : 0
        const daysOld = (now.getTime() - week.start.getTime()) / (1000 * 60 * 60 * 24)
        totalSocial += growth * temporalDecay(daysOld)
      }

      // Updates
      const updates = await ctx.db
        .query('weeklyUpdates')
        .withIndex('by_startupId', (q) => q.eq('startupId', s._id))
        .collect()
      let updatesScore = 0
      const streak = computeStreak(updates, now)
      const weekBase = computeUpdateScore(true, streak) * 10
      const isFavorite = updates.some((u) => u.weekOf === weeks[0].weekOf && u.isFavorite)
      for (const week of weeks) {
        const update = updates.find((u) => u.weekOf === week.weekOf)
        if (update) {
          let pts = weekBase
          if (update.isFavorite) pts += 25
          const daysOld = (now.getTime() - week.start.getTime()) / (1000 * 60 * 60 * 24)
          updatesScore += pts * temporalDecay(daysOld)
        }
      }

      // Milestones
      const milestones = await ctx.db
        .query('milestones')
        .withIndex('by_startupId', (q) => q.eq('startupId', s._id))
        .collect()
      const milestonesScore =
        milestones.length > 0
          ? (milestones.filter((m) => m.status === 'approved').length / milestones.length) * 100
          : 0

      rawData.push({
        startup: s,
        weeklyMrrGrowth,
        weeklyTraffic,
        weeklyGithub,
        totalMrrGrowth,
        totalTraffic,
        totalGithub,
        totalSocial,
        updatesScore,
        updateStreak: streak,
        milestonesScore,
        isFavoriteThisWeek: isFavorite,
      })
    }

    // Normalize
    const normRevenue = powerLawNormalize(
      rawData.map((d) => d.totalMrrGrowth),
      p
    )
    const normTraffic = powerLawNormalize(
      rawData.map((d) => d.totalTraffic),
      p
    )
    const normGithub = powerLawNormalize(
      rawData.map((d) => d.totalGithub),
      p
    )
    const normSocial = powerLawNormalize(
      rawData.map((d) => d.totalSocial),
      p
    )

    for (let i = 0; i < rawData.length; i++) {
      const d = rawData[i]
      const rev = Math.min(normRevenue[i], MAX_CAP) * WEIGHTS.revenue
      const trf = Math.min(normTraffic[i], MAX_CAP) * WEIGHTS.traffic
      const git = Math.min(normGithub[i], MAX_CAP) * WEIGHTS.github
      const soc = Math.min(normSocial[i], MAX_CAP) * WEIGHTS.social
      const upd = Math.min(d.updatesScore, MAX_CAP) * WEIGHTS.updates
      const mil = Math.min(d.milestonesScore, MAX_CAP) * WEIGHTS.milestones

      let total = rev + trf + git + soc + upd + mil
      const activeCats = [
        d.totalMrrGrowth,
        d.totalTraffic,
        d.totalGithub,
        d.updatesScore,
        d.milestonesScore,
      ].filter((v) => v > 0).length

      // Consistency bonus (same as admin version)
      const weeklyComposites: number[] = []
      for (let w = 0; w < weeks.length; w++) {
        weeklyComposites.push(
          Math.abs(d.weeklyMrrGrowth[w] ?? 0) +
            Math.abs(d.weeklyTraffic[w] ?? 0) +
            Math.abs(d.weeklyGithub[w] ?? 0)
        )
      }
      const consistencyBonus = computeConsistencyBonus(weeklyComposites)
      total *= 1 + consistencyBonus / 100

      if (d.isFavoriteThisWeek) total *= 1.25

      results.push({
        startupId: d.startup._id,
        startupName: d.startup.name,
        startupSlug: d.startup.slug,
        startupLogoUrl: d.startup.logoUrl,
        rank: null,
        totalScore: Math.round(total * 100) / 100,
        activeCategories: activeCats,
        qualified: activeCats >= QUALIFICATION_THRESHOLD,
        rankChange: null,
        isFavoriteThisWeek: d.isFavoriteThisWeek,
        updateStreak: d.updateStreak,
        excludeFromMetrics: d.startup.excludeFromMetrics === true,
      })
    }

    // Rank
    const ranked = results
      .filter((r) => r.qualified && !r.excludeFromMetrics)
      .sort((a, b) => b.totalScore - a.totalScore)
    ranked.forEach((r, i) => {
      r.rank = i + 1
    })

    // Compute rank changes (compare to last week's ranking)
    const prevScores: Array<{ startupId: Id<'startups'>; score: number }> = []
    for (const d of rawData) {
      let prevScore = 0
      for (let w = 1; w < weeks.length; w++) {
        const daysOld = (now.getTime() - weeks[w].start.getTime()) / (1000 * 60 * 60 * 24)
        const decay = temporalDecay(daysOld)
        prevScore += (d.weeklyMrrGrowth[w] ?? 0) * decay
        prevScore += (d.weeklyTraffic[w] ?? 0) * decay
      }
      prevScore += d.weeklyGithub[1] ?? 0
      prevScores.push({ startupId: d.startup._id, score: prevScore })
    }
    prevScores.sort((a, b) => b.score - a.score)
    const prevRankMap = new Map(prevScores.map((s, i) => [s.startupId, i + 1]))
    for (const r of ranked) {
      const prev = prevRankMap.get(r.startupId)
      if (prev != null && r.rank != null) {
        r.rankChange = prev - r.rank
      }
    }

    const unranked = results.filter((r) => !r.qualified || r.excludeFromMetrics)

    // Find current user's startup rank
    const myRank = results.find((r) => r.startupId === founderProfile.startupId)

    return {
      ranked,
      unranked,
      myStartupId: founderProfile.startupId,
      myRank: myRank?.rank ?? null,
      myScore: myRank?.totalScore ?? 0,
      cohortName: cohort.label,
    }
  },
})

/**
 * Update the normalization power value for a cohort (super_admin only).
 */
export const updateNormalizationPower = mutation({
  args: {
    cohortId: v.id('cohorts'),
    normalizationPower: v.number(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx)

    if (args.normalizationPower < 0.3 || args.normalizationPower > 1.0) {
      throw new Error('Normalization power must be between 0.3 and 1.0')
    }

    await ctx.db.patch(args.cohortId, {
      leaderboardConfig: {
        normalizationPower: args.normalizationPower,
      },
    })
  },
})
