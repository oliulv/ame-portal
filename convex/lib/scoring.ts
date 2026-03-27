/**
 * Shared scoring engine for leaderboard rankings.
 *
 * Score range: 0.0 – 1.0 (displayed as 0–100 in the UI).
 *
 * Categories (v1, no social):
 *   Revenue  25%  — MRR growth rate (week-over-week %)
 *   Traffic  20%  — Session growth rate (week-over-week %)
 *   GitHub   20%  — Commits + PRs + reviews (summed across founders)
 *   Updates  20%  — Weekly update submitted (binary) + streak bonus
 *   Milestones 15% — Approved / due milestones (completion rate)
 */

// ── Constants ────────────────────────────────────────────────────────

export const CATEGORY_KEYS = ['revenue', 'traffic', 'github', 'updates', 'milestones'] as const
export type CategoryKey = (typeof CATEGORY_KEYS)[number]

export const WEIGHTS: Record<CategoryKey, number> = {
  revenue: 0.25,
  traffic: 0.2,
  github: 0.2,
  updates: 0.2,
  milestones: 0.15,
}

export const DECAY_RATE = 0.03
export const ROLLING_WEEKS = 4
export const QUALIFICATION_THRESHOLD = 3
export const MOMENTUM_THRESHOLD = 0.05 // 5% change
export const GROWTH_RATE_CAP_MAX = 200 // +200%
export const GROWTH_RATE_CAP_MIN = -100 // -100%

// ── Types ────────────────────────────────────────────────────────────

export interface CategoryMetric {
  key: CategoryKey
  /** Weekly raw values (most-recent week first, length = ROLLING_WEEKS). */
  weeklyValues: number[]
  /** True when the startup has had at least one data point in the last 30 days. */
  active: boolean
}

export interface ScoringConfig {
  normalizationPower: number // 0.3 – 1.0, default 0.7
}

export interface CategoryScore {
  raw: number
  normalized: number
  weighted: number
}

export interface ScoreResult {
  totalScore: number
  categories: Record<CategoryKey, CategoryScore>
  activeCategories: number
  qualified: boolean
  consistencyBonus: number
  momentum: 'up' | 'flat' | 'down' | null
}

// ── Pure scoring functions ───────────────────────────────────────────

/** Exponential temporal decay based on week index (0 = current week). */
export function temporalDecay(weekIndex: number): number {
  const daysOld = weekIndex * 7
  return Math.exp(-DECAY_RATE * daysOld)
}

/**
 * Power-law normalization: compresses the distribution so outliers
 * don't dominate. A power < 1 makes scores closer together.
 *
 * Returns 0–1. If maxInCohort is 0, returns 0.
 */
export function powerLawNormalize(raw: number, maxInCohort: number, power: number): number {
  if (maxInCohort <= 0) return 0
  const ratio = Math.max(0, raw) / maxInCohort
  return Math.pow(Math.min(ratio, 1), power)
}

/**
 * Compute week-over-week growth rate with edge-case handling.
 *
 * Returns a percentage (e.g. 50 for +50%), capped to [-100, +200].
 * Returns `null` if both values are 0 (category inactive for this week).
 */
export function computeGrowthRate(current: number, previous: number): number | null {
  if (current === 0 && previous === 0) return null
  if (previous === 0 && current > 0) return 100 // zero-to-positive
  if (previous > 0 && current === 0) return -100 // positive-to-zero
  const rate = ((current - previous) / previous) * 100
  return Math.max(GROWTH_RATE_CAP_MIN, Math.min(GROWTH_RATE_CAP_MAX, rate))
}

/**
 * Consistency bonus based on coefficient of variation of weekly scores.
 * Requires >= 4 weekly scores; otherwise returns 0.
 *
 * CV < 0.2  → +0.05
 * CV 0.2–0.5 → 0
 * CV > 0.5  → -0.05
 */
export function computeConsistencyBonus(weeklyScores: number[]): number {
  const valid = weeklyScores.filter((s) => s > 0)
  if (valid.length < ROLLING_WEEKS) return 0
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length
  if (mean === 0) return 0
  const variance = valid.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / valid.length
  const cv = Math.sqrt(variance) / mean
  if (cv < 0.2) return 0.05
  if (cv > 0.5) return -0.05
  return 0
}

/** Momentum arrow: compare two consecutive week scores. */
export function computeMomentumArrow(
  thisWeek: number,
  lastWeek: number
): 'up' | 'flat' | 'down' | null {
  if (lastWeek === 0 && thisWeek === 0) return null
  if (lastWeek === 0) return 'up'
  const change = (thisWeek - lastWeek) / lastWeek
  if (change > MOMENTUM_THRESHOLD) return 'up'
  if (change < -MOMENTUM_THRESHOLD) return 'down'
  return 'flat'
}

/** Check if a startup qualifies for extra funding (>= 3/5 active categories). */
export function isQualified(activeCategoryCount: number): boolean {
  return activeCategoryCount >= QUALIFICATION_THRESHOLD
}

/**
 * Weekly update raw score: binary submit + streak bonus.
 *
 * raw = 1.0 if submitted, else 0.0
 * streak_bonus = 0.1 × min(streak, 8)   →  max +0.8
 * total range: 0.0 – 1.8
 */
export function computeUpdateScore(submitted: boolean, streak: number): number {
  const base = submitted ? 1.0 : 0.0
  const bonus = 0.1 * Math.min(streak, 8)
  return base + bonus
}

// ── Main scoring function ────────────────────────────────────────────

/**
 * Compute the composite score for a single startup given its per-category
 * weekly metric values, the cohort maximums, and scoring config.
 *
 * `maxInCohort` maps each category to the highest decayed-raw value among
 * ALL startups in the cohort for this scoring cycle.
 */
export function computeStartupScore(
  metrics: CategoryMetric[],
  maxInCohort: Record<CategoryKey, number>,
  config: ScoringConfig,
  previousWeekScore?: number
): ScoreResult {
  const categories = {} as Record<CategoryKey, CategoryScore>
  let activeCount = 0
  let activeWeightSum = 0

  // Step 1-2: Compute decayed raw per category
  for (const metric of metrics) {
    let decayedRaw = 0
    for (let w = 0; w < metric.weeklyValues.length; w++) {
      decayedRaw += metric.weeklyValues[w] * temporalDecay(w)
    }

    // Step 3: Normalize against cohort
    const normalized = powerLawNormalize(
      decayedRaw,
      maxInCohort[metric.key],
      config.normalizationPower
    )

    if (metric.active) {
      activeCount++
      activeWeightSum += WEIGHTS[metric.key]
    }

    categories[metric.key] = {
      raw: decayedRaw,
      normalized,
      weighted: 0, // computed below after we know active weights
    }
  }

  // Fill in any missing categories
  for (const key of CATEGORY_KEYS) {
    if (!categories[key]) {
      categories[key] = { raw: 0, normalized: 0, weighted: 0 }
    }
  }

  // Step 4: Weight and sum active categories only
  let baseScore = 0
  if (activeWeightSum > 0) {
    for (const metric of metrics) {
      if (metric.active) {
        const reWeighted =
          categories[metric.key].normalized * (WEIGHTS[metric.key] / activeWeightSum)
        categories[metric.key].weighted = reWeighted
        baseScore += reWeighted
      }
    }
  }

  // Step 5: Consistency bonus
  const weeklyComposites = computeWeeklyComposites(metrics, maxInCohort, config)
  const consistencyBonus = computeConsistencyBonus(weeklyComposites)

  // Step 6: Final score capped at 1.0
  const totalScore = Math.min(baseScore + consistencyBonus, 1.0)

  // Momentum
  const momentum =
    previousWeekScore !== undefined ? computeMomentumArrow(totalScore, previousWeekScore) : null

  return {
    totalScore,
    categories,
    activeCategories: activeCount,
    qualified: isQualified(activeCount),
    consistencyBonus,
    momentum,
  }
}

/**
 * Helper: compute per-week composite scores for consistency calculation.
 * Each week gets a mini-score using the same normalization.
 */
function computeWeeklyComposites(
  metrics: CategoryMetric[],
  maxInCohort: Record<CategoryKey, number>,
  config: ScoringConfig
): number[] {
  const weekCount = metrics[0]?.weeklyValues.length ?? 0
  const composites: number[] = []

  for (let w = 0; w < weekCount; w++) {
    let weekScore = 0
    let weekActiveWeight = 0
    for (const metric of metrics) {
      if (!metric.active) continue
      const val = metric.weeklyValues[w] ?? 0
      const norm = powerLawNormalize(val, maxInCohort[metric.key], config.normalizationPower)
      weekActiveWeight += WEIGHTS[metric.key]
      weekScore += norm * WEIGHTS[metric.key]
    }
    if (weekActiveWeight > 0) {
      composites.push(weekScore / weekActiveWeight)
    } else {
      composites.push(0)
    }
  }

  return composites
}
