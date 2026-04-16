import { describe, it, expect } from 'bun:test'
import {
  computeGrowthRate,
  temporalDecay,
  powerLawNormalize,
  computeConsistencyBonus,
  isQualified,
  computeUpdateScore,
  computeStartupScore,
  computeVelocityScore,
  computeVelocityBreakdown,
  CATEGORY_KEYS,
  WEIGHTS,
  DECAY_RATE,
  COMMIT_PTS,
  PR_PTS,
  ISSUE_PTS,
  ROLLING_WEEKS,
  QUALIFICATION_THRESHOLD,
  GROWTH_RATE_CAP_MAX,
  GROWTH_RATE_CAP_MIN,
  type CategoryMetric,
  type ScoringConfig,
  type CategoryKey,
  type TypedDayCounts,
} from './scoring'

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a full set of 5 category metrics for computeStartupScore tests. */
function makeMetrics(
  overrides: Partial<Record<CategoryKey, { weeklyValues: number[]; active: boolean }>> = {}
): CategoryMetric[] {
  return CATEGORY_KEYS.map((key) => ({
    key,
    weeklyValues: overrides[key]?.weeklyValues ?? [0, 0, 0, 0],
    active: overrides[key]?.active ?? false,
  }))
}

function makeMaxInCohort(
  overrides: Partial<Record<CategoryKey, number>> = {}
): Record<CategoryKey, number> {
  const defaults: Record<CategoryKey, number> = {
    revenue: 100,
    traffic: 100,
    github: 100,
    updates: 100,
    milestones: 100,
  }
  return { ...defaults, ...overrides }
}

const DEFAULT_CONFIG: ScoringConfig = { normalizationPower: 0.7 }

// ── computeGrowthRate ────────────────────────────────────────────────

describe('computeGrowthRate', () => {
  it('should compute normal positive growth (100 -> 150 = +50%)', () => {
    expect(computeGrowthRate(150, 100)).toBe(50)
  })

  it('should compute negative growth (200 -> 100 = -50%)', () => {
    expect(computeGrowthRate(100, 200)).toBe(-50)
  })

  it('should return +100% for zero-to-positive (0 -> 100)', () => {
    expect(computeGrowthRate(100, 0)).toBe(100)
  })

  it('should return -100% for positive-to-zero (100 -> 0)', () => {
    expect(computeGrowthRate(0, 100)).toBe(-100)
  })

  it('should return null when both values are zero (inactive)', () => {
    expect(computeGrowthRate(0, 0)).toBeNull()
  })

  it('should cap growth at +200% (100 -> 500 = 400% but capped)', () => {
    const result = computeGrowthRate(500, 100)
    expect(result).toBe(GROWTH_RATE_CAP_MAX)
    expect(result).toBe(200)
  })

  it('should cap at -100% for extreme negative growth', () => {
    // -100% is the minimum but normal positive-to-zero already returns -100
    // Test a case where the formula would give something beyond -100 if uncapped
    // Actually ((0.001 - 100) / 100) * 100 = -99.999 which is within bounds
    // The code already returns -100 for current=0 via the special case
    expect(computeGrowthRate(0, 50)).toBe(-100)
  })

  it('should handle small negative growth within bounds', () => {
    // 90 -> 85 = -5.55%
    const result = computeGrowthRate(85, 90)
    expect(result).toBeCloseTo(-5.556, 2)
    expect(result!).toBeGreaterThan(GROWTH_RATE_CAP_MIN)
    expect(result!).toBeLessThan(0)
  })

  it('should handle exact +200% growth without capping', () => {
    // 100 -> 300 = +200%
    expect(computeGrowthRate(300, 100)).toBe(200)
  })

  it('should cap growth just above +200%', () => {
    // 100 -> 301 = +201% -> capped to 200
    expect(computeGrowthRate(301, 100)).toBe(200)
  })
})

// ── temporalDecay ────────────────────────────────────────────────────

describe('temporalDecay', () => {
  it('should return 1.0 for week 0 (current week)', () => {
    expect(temporalDecay(0)).toBe(1.0)
  })

  it('should return approximately 0.81 for week 1', () => {
    const expected = Math.exp(-DECAY_RATE * 7)
    const result = temporalDecay(1)
    expect(result).toBeCloseTo(expected, 6)
    expect(result).toBeCloseTo(0.81, 1)
  })

  it('should return approximately 0.53 for week 3', () => {
    const expected = Math.exp(-DECAY_RATE * 21)
    const result = temporalDecay(3)
    expect(result).toBeCloseTo(expected, 6)
    expect(result).toBeCloseTo(0.53, 1)
  })

  it('should always return positive values', () => {
    for (let w = 0; w <= 52; w++) {
      const val = temporalDecay(w)
      expect(val).toBeGreaterThan(0)
    }
  })

  it('should be monotonically decreasing with age', () => {
    let prev = temporalDecay(0)
    for (let w = 1; w <= 10; w++) {
      const current = temporalDecay(w)
      expect(current).toBeLessThan(prev)
      prev = current
    }
  })

  it('should use DECAY_RATE constant (0.03) and week-to-days conversion', () => {
    const week2 = temporalDecay(2)
    const manual = Math.exp(-0.03 * 14)
    expect(week2).toBe(manual)
  })
})

// ── powerLawNormalize ────────────────────────────────────────────────

describe('powerLawNormalize', () => {
  it('should return raw/max when power = 1.0 (linear)', () => {
    expect(powerLawNormalize(50, 100, 1.0)).toBeCloseTo(0.5, 6)
    expect(powerLawNormalize(25, 100, 1.0)).toBeCloseTo(0.25, 6)
    expect(powerLawNormalize(100, 100, 1.0)).toBeCloseTo(1.0, 6)
  })

  it('should compress distribution when power = 0.7', () => {
    const linear = powerLawNormalize(50, 100, 1.0)
    const compressed = powerLawNormalize(50, 100, 0.7)
    // With power < 1, mid-range values are pulled higher (compressed)
    expect(compressed).toBeGreaterThan(linear)
  })

  it('should return 0 when maxInCohort = 0', () => {
    expect(powerLawNormalize(50, 0, 0.7)).toBe(0)
  })

  it('should return 0 when maxInCohort is negative', () => {
    expect(powerLawNormalize(50, -10, 0.7)).toBe(0)
  })

  it('should return 0 when raw = 0', () => {
    expect(powerLawNormalize(0, 100, 0.7)).toBe(0)
  })

  it('should return 1.0 when raw = maxInCohort', () => {
    expect(powerLawNormalize(100, 100, 0.7)).toBeCloseTo(1.0, 6)
    expect(powerLawNormalize(100, 100, 0.5)).toBeCloseTo(1.0, 6)
    expect(powerLawNormalize(100, 100, 1.0)).toBeCloseTo(1.0, 6)
  })

  it('should clamp ratio at 1.0 when raw > maxInCohort', () => {
    expect(powerLawNormalize(150, 100, 0.7)).toBeCloseTo(1.0, 6)
  })

  it('should treat negative raw as 0', () => {
    expect(powerLawNormalize(-10, 100, 0.7)).toBe(0)
  })

  it('should produce correct value for known inputs with power 0.7', () => {
    // raw=50, max=100 => ratio=0.5 => 0.5^0.7
    const expected = Math.pow(0.5, 0.7)
    expect(powerLawNormalize(50, 100, 0.7)).toBeCloseTo(expected, 6)
  })
})

// ── computeConsistencyBonus ──────────────────────────────────────────

describe('computeConsistencyBonus', () => {
  it('should return +0.05 for all identical scores (low CV)', () => {
    // All identical => CV = 0 => < 0.2 => +0.05
    expect(computeConsistencyBonus([0.5, 0.5, 0.5, 0.5])).toBe(0.05)
  })

  it('should return -0.05 for high variance scores', () => {
    // Very different values => high CV
    expect(computeConsistencyBonus([0.1, 0.9, 0.1, 0.9])).toBe(-0.05)
  })

  it('should return 0 for medium variance', () => {
    // Need CV between 0.2 and 0.5
    // Values with moderate variance: mean=0.5, want std/mean ~ 0.3
    // std ~ 0.15, variance ~ 0.0225
    // [0.35, 0.5, 0.65, 0.5] => mean=0.5, variance=0.00625, std=0.079 => CV=0.158 => <0.2 => +0.05
    // Need higher variance: [0.3, 0.5, 0.7, 0.5] => mean=0.5, var=0.02, std=0.1414, CV=0.283 => between 0.2 and 0.5
    expect(computeConsistencyBonus([0.3, 0.5, 0.7, 0.5])).toBe(0)
  })

  it('should return 0 for fewer than 4 weekly scores (not enough data)', () => {
    expect(computeConsistencyBonus([0.5, 0.5, 0.5])).toBe(0)
    expect(computeConsistencyBonus([0.5, 0.5])).toBe(0)
    expect(computeConsistencyBonus([0.5])).toBe(0)
  })

  it('should return 0 for empty array', () => {
    expect(computeConsistencyBonus([])).toBe(0)
  })

  it('should filter out zero scores before computing CV', () => {
    // [0.5, 0.5, 0.5, 0.5, 0] => valid = [0.5, 0.5, 0.5, 0.5] => CV=0 => +0.05
    expect(computeConsistencyBonus([0.5, 0.5, 0.5, 0.5, 0])).toBe(0.05)
  })

  it('should return 0 when all scores are zero (mean = 0 guard)', () => {
    // All zeros get filtered out => valid.length < 4 => returns 0
    expect(computeConsistencyBonus([0, 0, 0, 0])).toBe(0)
  })

  it('should return 0 when there are not enough positive scores', () => {
    // Only 3 positive values after filtering zeros
    expect(computeConsistencyBonus([0.5, 0.5, 0.5, 0])).toBe(0)
  })
})

// ── isQualified ──────────────────────────────────────────────────────

describe('isQualified', () => {
  it('should return true for 3 active categories (threshold)', () => {
    expect(isQualified(3)).toBe(true)
  })

  it('should return false for 2 active categories', () => {
    expect(isQualified(2)).toBe(false)
  })

  it('should return true for 5 active categories', () => {
    expect(isQualified(5)).toBe(true)
  })

  it('should return false for 0 active categories', () => {
    expect(isQualified(0)).toBe(false)
  })

  it('should return true for 4 active categories', () => {
    expect(isQualified(4)).toBe(true)
  })

  it('should return false for 1 active category', () => {
    expect(isQualified(1)).toBe(false)
  })

  it('should use QUALIFICATION_THRESHOLD constant (3)', () => {
    expect(QUALIFICATION_THRESHOLD).toBe(3)
    expect(isQualified(QUALIFICATION_THRESHOLD)).toBe(true)
    expect(isQualified(QUALIFICATION_THRESHOLD - 1)).toBe(false)
  })
})

// ── computeUpdateScore ───────────────────────────────────────────────

describe('computeUpdateScore', () => {
  it('should return 1.0 for submitted with 0 streak', () => {
    expect(computeUpdateScore(true, 0)).toBe(1.0)
  })

  it('should return 1.4 for submitted with streak of 4', () => {
    // base=1.0, bonus = 0.1 * min(4, 8) = 0.4 => 1.4
    expect(computeUpdateScore(true, 4)).toBeCloseTo(1.4, 6)
  })

  it('should cap streak bonus at 8 (submitted with streak 10 = 1.8)', () => {
    // base=1.0, bonus = 0.1 * min(10, 8) = 0.8 => 1.8
    expect(computeUpdateScore(true, 10)).toBeCloseTo(1.8, 6)
  })

  it('should return 0.0 + streak bonus when not submitted', () => {
    // base=0.0, bonus = 0.1 * min(4, 8) = 0.4 => 0.4
    expect(computeUpdateScore(false, 4)).toBeCloseTo(0.4, 6)
  })

  it('should return 0.0 for not submitted with 0 streak', () => {
    expect(computeUpdateScore(false, 0)).toBe(0.0)
  })

  it('should cap streak bonus at 0.8 regardless of submission', () => {
    // submitted: base=1.0 + 0.8 = 1.8
    expect(computeUpdateScore(true, 100)).toBeCloseTo(1.8, 6)
    // not submitted: base=0.0 + 0.8 = 0.8
    expect(computeUpdateScore(false, 100)).toBeCloseTo(0.8, 6)
  })

  it('should return 1.8 for submitted with streak of exactly 8', () => {
    expect(computeUpdateScore(true, 8)).toBeCloseTo(1.8, 6)
  })

  it('should handle streak of 1 correctly', () => {
    // submitted: 1.0 + 0.1 = 1.1
    expect(computeUpdateScore(true, 1)).toBeCloseTo(1.1, 6)
    // not submitted: 0.0 + 0.1 = 0.1
    expect(computeUpdateScore(false, 1)).toBeCloseTo(0.1, 6)
  })
})

// ── computeStartupScore (integration) ────────────────────────────────

describe('computeStartupScore', () => {
  it('should return score 0-1 and qualified=true when all 5 categories are active', () => {
    const metrics = makeMetrics({
      revenue: { weeklyValues: [80, 60, 40, 20], active: true },
      traffic: { weeklyValues: [70, 50, 30, 10], active: true },
      github: { weeklyValues: [50, 40, 30, 20], active: true },
      updates: { weeklyValues: [1.5, 1.2, 1.0, 0.8], active: true },
      milestones: { weeklyValues: [60, 50, 40, 30], active: true },
    })
    const maxInCohort = makeMaxInCohort()

    const result = computeStartupScore(metrics, maxInCohort, DEFAULT_CONFIG)

    expect(result.totalScore).toBeGreaterThanOrEqual(0)
    expect(result.totalScore).toBeLessThanOrEqual(1)
    expect(result.qualified).toBe(true)
    expect(result.activeCategories).toBe(5)
  })

  it('should return qualified=false when only 2 categories are active', () => {
    const metrics = makeMetrics({
      revenue: { weeklyValues: [80, 60, 40, 20], active: true },
      traffic: { weeklyValues: [70, 50, 30, 10], active: true },
    })
    const maxInCohort = makeMaxInCohort()

    const result = computeStartupScore(metrics, maxInCohort, DEFAULT_CONFIG)

    expect(result.totalScore).toBeGreaterThanOrEqual(0)
    expect(result.totalScore).toBeLessThanOrEqual(1)
    expect(result.qualified).toBe(false)
    expect(result.activeCategories).toBe(2)
  })

  it('should re-normalize weights for active categories only', () => {
    // With only revenue (0.25) and traffic (0.20) active:
    // activeWeightSum = 0.45
    // revenue weighted = normalized * (0.25 / 0.45)
    // traffic weighted = normalized * (0.20 / 0.45)
    // These should sum to 1.0 * normalizedAvg (approximately)
    const metrics = makeMetrics({
      revenue: { weeklyValues: [100, 100, 100, 100], active: true },
      traffic: { weeklyValues: [100, 100, 100, 100], active: true },
    })
    const maxInCohort = makeMaxInCohort()

    const result = computeStartupScore(metrics, maxInCohort, DEFAULT_CONFIG)

    // Both at max => normalized = 1.0 each
    // weighted: revenue = 1.0 * (0.25/0.45), traffic = 1.0 * (0.20/0.45)
    // sum = 0.45/0.45 = 1.0 (before consistency bonus)
    const revenueWeighted = result.categories.revenue.weighted
    const trafficWeighted = result.categories.traffic.weighted
    expect(revenueWeighted).toBeCloseTo(0.25 / 0.45, 4)
    expect(trafficWeighted).toBeCloseTo(0.2 / 0.45, 4)
  })

  it('should return score 0 when all metrics are zero', () => {
    const metrics = makeMetrics() // all zeros, all inactive
    const maxInCohort = makeMaxInCohort()

    const result = computeStartupScore(metrics, maxInCohort, DEFAULT_CONFIG)

    expect(result.totalScore).toBe(0)
    expect(result.activeCategories).toBe(0)
    expect(result.qualified).toBe(false)
  })

  it('should apply consistency bonus to the final score', () => {
    // Create consistent metrics (identical weekly values) to trigger +0.05 bonus
    const metrics = makeMetrics({
      revenue: { weeklyValues: [50, 50, 50, 50], active: true },
      traffic: { weeklyValues: [50, 50, 50, 50], active: true },
      github: { weeklyValues: [50, 50, 50, 50], active: true },
      updates: { weeklyValues: [50, 50, 50, 50], active: true },
      milestones: { weeklyValues: [50, 50, 50, 50], active: true },
    })
    const maxInCohort = makeMaxInCohort()

    const result = computeStartupScore(metrics, maxInCohort, DEFAULT_CONFIG)

    // Weekly composites should be identical => CV=0 => +0.05 bonus
    expect(result.consistencyBonus).toBe(0.05)
  })

  it('should cap total score at 1.0 even with consistency bonus', () => {
    // Max everything out so base score = 1.0, plus consistency bonus = 1.05 => capped at 1.0
    const metrics = makeMetrics({
      revenue: { weeklyValues: [100, 100, 100, 100], active: true },
      traffic: { weeklyValues: [100, 100, 100, 100], active: true },
      github: { weeklyValues: [100, 100, 100, 100], active: true },
      updates: { weeklyValues: [100, 100, 100, 100], active: true },
      milestones: { weeklyValues: [100, 100, 100, 100], active: true },
    })
    const maxInCohort = makeMaxInCohort()

    const result = computeStartupScore(metrics, maxInCohort, DEFAULT_CONFIG)

    expect(result.totalScore).toBeLessThanOrEqual(1.0)
  })

  it('should fill in missing categories with zero scores', () => {
    // Only provide 2 metrics instead of 5
    const metrics: CategoryMetric[] = [
      { key: 'revenue', weeklyValues: [50, 50, 50, 50], active: true },
      { key: 'traffic', weeklyValues: [50, 50, 50, 50], active: true },
    ]
    const maxInCohort = makeMaxInCohort()

    const result = computeStartupScore(metrics, maxInCohort, DEFAULT_CONFIG)

    // Missing categories should be filled with zeros
    expect(result.categories.github.raw).toBe(0)
    expect(result.categories.github.normalized).toBe(0)
    expect(result.categories.github.weighted).toBe(0)
    expect(result.categories.updates.raw).toBe(0)
    expect(result.categories.milestones.raw).toBe(0)
  })

  it('should apply temporal decay to weekly values (recent weeks matter more)', () => {
    // Startup A: all activity in week 0 (most recent)
    const metricsRecent = makeMetrics({
      revenue: { weeklyValues: [100, 0, 0, 0], active: true },
    })
    // Startup B: all activity in week 3 (oldest)
    const metricsOld = makeMetrics({
      revenue: { weeklyValues: [0, 0, 0, 100], active: true },
    })
    const maxInCohort = makeMaxInCohort({ revenue: 200 })

    const resultRecent = computeStartupScore(metricsRecent, maxInCohort, DEFAULT_CONFIG)
    const resultOld = computeStartupScore(metricsOld, maxInCohort, DEFAULT_CONFIG)

    // Recent activity should score higher due to temporal decay
    expect(resultRecent.categories.revenue.raw).toBeGreaterThan(resultOld.categories.revenue.raw)
  })

  it('should handle inactive categories with nonzero values (weighted = 0)', () => {
    const metrics = makeMetrics({
      revenue: { weeklyValues: [50, 50, 50, 50], active: false },
      traffic: { weeklyValues: [50, 50, 50, 50], active: true },
      github: { weeklyValues: [50, 50, 50, 50], active: true },
      updates: { weeklyValues: [50, 50, 50, 50], active: true },
    })
    const maxInCohort = makeMaxInCohort()

    const result = computeStartupScore(metrics, maxInCohort, DEFAULT_CONFIG)

    // Revenue is inactive: it will have raw and normalized values but weighted=0
    expect(result.categories.revenue.raw).toBeGreaterThan(0)
    expect(result.categories.revenue.normalized).toBeGreaterThan(0)
    expect(result.categories.revenue.weighted).toBe(0)
    expect(result.activeCategories).toBe(3)
  })
})

// ── Constants sanity checks ──────────────────────────────────────────

describe('constants', () => {
  it('should have 5 category keys', () => {
    expect(CATEGORY_KEYS.length).toBe(5)
  })

  it('should have weights that sum to 1.0', () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 6)
  })

  it('should use expected default values', () => {
    expect(DECAY_RATE).toBe(0.03)
    expect(ROLLING_WEEKS).toBe(4)
    expect(QUALIFICATION_THRESHOLD).toBe(3)
    expect(GROWTH_RATE_CAP_MAX).toBe(200)
    expect(GROWTH_RATE_CAP_MIN).toBe(-100)
  })
})

// ── computeVelocityScore & computeVelocityBreakdown ─────────────────

describe('computeVelocityScore & computeVelocityBreakdown', () => {
  const AS_OF = new Date('2026-04-15T00:00:00.000Z')

  /** Build a date string N days before asOf. */
  function daysBeforeAsOf(daysAgo: number): string {
    const d = new Date(AS_OF.getTime())
    d.setUTCDate(d.getUTCDate() - daysAgo)
    return d.toISOString().slice(0, 10)
  }

  it('should compute known score for 28 days of 1 commit each', () => {
    // Build calendar: each of the 28 days (d=0..27) has exactly 1 commit
    const calendar: TypedDayCounts = {}
    let expectedScore = 0
    for (let d = 0; d < 28; d++) {
      calendar[daysBeforeAsOf(d)] = { commits: 1, prs: 0, issues: 0 }
      expectedScore += COMMIT_PTS * Math.exp(-DECAY_RATE * d)
    }

    const score = computeVelocityScore(calendar, AS_OF)
    expect(score).toBe(Math.round(expectedScore))
  })

  it('should apply per-type weights correctly on day 0 (no decay)', () => {
    // Only day 0 has activity: 1 commit + 1 PR + 1 issue
    const calendar: TypedDayCounts = {
      [daysBeforeAsOf(0)]: { commits: 1, prs: 1, issues: 1 },
    }

    const score = computeVelocityScore(calendar, AS_OF)
    // exp(-0.03 * 0) = 1.0, so score = (10 + 25 + 15) * 1 = 50
    expect(score).toBe(COMMIT_PTS + PR_PTS + ISSUE_PTS)
    expect(score).toBe(50)
  })

  it('should return a breakdown whose per-type points sum to total (within rounding tolerance)', () => {
    // Multi-day calendar with mixed types
    const calendar: TypedDayCounts = {
      [daysBeforeAsOf(0)]: { commits: 3, prs: 1, issues: 2 },
      [daysBeforeAsOf(5)]: { commits: 0, prs: 2, issues: 0 },
      [daysBeforeAsOf(14)]: { commits: 5, prs: 0, issues: 1 },
      [daysBeforeAsOf(27)]: { commits: 1, prs: 1, issues: 1 },
    }

    const breakdown = computeVelocityBreakdown(calendar, AS_OF)
    const partsSum = breakdown.commits.points + breakdown.prs.points + breakdown.issues.points

    // Each part is Math.round() individually, total is Math.round() of the unrounded sum,
    // so the difference can be at most 1 due to rounding.
    expect(Math.abs(partsSum - breakdown.total)).toBeLessThanOrEqual(1)

    // Also verify raw counts are correct
    expect(breakdown.commits.count).toBe(3 + 0 + 5 + 1)
    expect(breakdown.prs.count).toBe(1 + 2 + 0 + 1)
    expect(breakdown.issues.count).toBe(2 + 0 + 1 + 1)
  })

  it('should return 0 for everything when the calendar is empty', () => {
    const calendar: TypedDayCounts = {}

    const score = computeVelocityScore(calendar, AS_OF)
    expect(score).toBe(0)

    const breakdown = computeVelocityBreakdown(calendar, AS_OF)
    expect(breakdown.total).toBe(0)
    expect(breakdown.commits).toEqual({ count: 0, points: 0 })
    expect(breakdown.prs).toEqual({ count: 0, points: 0 })
    expect(breakdown.issues).toEqual({ count: 0, points: 0 })
    expect(breakdown.rawTotal).toBe(0)
  })

  it('should decay older contributions: day-0 commit scores more than day-27 commit', () => {
    const calendarDay0: TypedDayCounts = {
      [daysBeforeAsOf(0)]: { commits: 1, prs: 0, issues: 0 },
    }
    const calendarDay27: TypedDayCounts = {
      [daysBeforeAsOf(27)]: { commits: 1, prs: 0, issues: 0 },
    }

    const scoreDay0 = computeVelocityScore(calendarDay0, AS_OF)
    const scoreDay27 = computeVelocityScore(calendarDay27, AS_OF)

    // Day 0: 10 * exp(0) = 10 -> rounds to 10
    expect(scoreDay0).toBe(10)
    // Day 27: 10 * exp(-0.03 * 27) -> rounds to ~4
    expect(scoreDay27).toBe(Math.round(COMMIT_PTS * Math.exp(-DECAY_RATE * 27)))
    expect(scoreDay0).toBeGreaterThan(scoreDay27)

    // Verify the ratio matches the expected decay factor
    // Use the unrounded values for a precise ratio check
    const expectedRatio = Math.exp(-DECAY_RATE * 27) // ~0.4449
    const actualRatio = scoreDay27 / scoreDay0
    expect(actualRatio).toBeCloseTo(expectedRatio, 1)
  })
})
