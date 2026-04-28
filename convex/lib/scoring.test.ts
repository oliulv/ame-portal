import { describe, it, expect } from 'bun:test'
import {
  computeGrowthRate,
  temporalDecay,
  powerLawNormalize,
  isQualified,
  computeUpdateScore,
  computeFavoriteMultiplier,
  computeLeaderboardScore,
  computeVelocityScore,
  computeVelocityBreakdown,
  buildVelocityTimeSeries,
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
  FAVORITE_WEIGHT,
  FAVORITE_DECAY_RATE,
  FAVORITE_WINDOW_DAYS,
  type ScoringConfig,
  type CategoryKey,
  type TypedDayCounts,
} from './scoring'

// ── Helpers ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ScoringConfig = { normalizationPower: 0.7 }

/** Build a per-category record with defaults, with overrides applied. */
function cat<T>(
  defaults: T,
  overrides: Partial<Record<CategoryKey, T>> = {}
): Record<CategoryKey, T> {
  const out = {} as Record<CategoryKey, T>
  for (const k of CATEGORY_KEYS) {
    out[k] = (overrides[k] ?? defaults) as T
  }
  return out
}

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
    // (500 - 100) / 100 * 100 = 400 => capped at 200
    expect(computeGrowthRate(500, 100)).toBe(200)
  })

  it('should cap at -100% for extreme negative growth', () => {
    // Can't actually compute -200% growth without going below zero, but
    // the cap should still apply if the formula produces < -100
    // (100 - 500) / 500 * 100 = -80 (not capped)
    expect(computeGrowthRate(100, 500)).toBe(-80)
  })

  it('should handle small negative growth within bounds', () => {
    // 90 -> 85 is -5.55%
    expect(computeGrowthRate(85, 90)).toBeCloseTo(-5.556, 2)
  })

  it('should handle exact +200% growth without capping', () => {
    // 100 -> 300 is exactly +200%
    expect(computeGrowthRate(300, 100)).toBe(200)
  })

  it('should cap growth just above +200%', () => {
    // 100 -> 301 is +201%, capped to +200
    expect(computeGrowthRate(301, 100)).toBe(200)
  })
})

// ── temporalDecay ────────────────────────────────────────────────────

describe('temporalDecay', () => {
  it('should return 1.0 for week 0 (current week)', () => {
    expect(temporalDecay(0)).toBe(1.0)
  })

  it('should return approximately 0.81 for week 1', () => {
    // exp(-0.03 * 7) ≈ 0.810584
    expect(temporalDecay(1)).toBeCloseTo(0.8106, 3)
  })

  it('should return approximately 0.53 for week 3', () => {
    // exp(-0.03 * 21) ≈ 0.532592
    expect(temporalDecay(3)).toBeCloseTo(0.5326, 3)
  })

  it('should always return positive values', () => {
    expect(temporalDecay(10)).toBeGreaterThan(0)
    expect(temporalDecay(100)).toBeGreaterThan(0)
  })

  it('should be monotonically decreasing with age', () => {
    const w0 = temporalDecay(0)
    const w1 = temporalDecay(1)
    const w2 = temporalDecay(2)
    const w3 = temporalDecay(3)
    expect(w0).toBeGreaterThan(w1)
    expect(w1).toBeGreaterThan(w2)
    expect(w2).toBeGreaterThan(w3)
  })

  it('should use DECAY_RATE constant (0.03) and week-to-days conversion', () => {
    // Verify the formula directly
    expect(temporalDecay(2)).toBeCloseTo(Math.exp(-DECAY_RATE * 14), 6)
  })
})

// ── powerLawNormalize ────────────────────────────────────────────────

describe('powerLawNormalize', () => {
  it('should return raw/max when power = 1.0 (linear)', () => {
    // 50/100 = 0.5, raised to 1.0 power = 0.5
    expect(powerLawNormalize(50, 100, 1.0)).toBe(0.5)
  })

  it('should compress distribution when power = 0.7', () => {
    // 50/100 = 0.5, raised to 0.7 power = 0.5^0.7 ≈ 0.616
    const expected = Math.pow(0.5, 0.7)
    expect(powerLawNormalize(50, 100, 0.7)).toBeCloseTo(expected, 6)
  })

  it('should return 0 when maxInCohort = 0', () => {
    expect(powerLawNormalize(100, 0, 0.7)).toBe(0)
  })

  it('should return 0 when maxInCohort is negative', () => {
    expect(powerLawNormalize(100, -1, 0.7)).toBe(0)
  })

  it('should return 0 when raw = 0', () => {
    expect(powerLawNormalize(0, 100, 0.7)).toBe(0)
  })

  it('should return 1.0 when raw = maxInCohort', () => {
    // 100/100 = 1.0, raised to 0.7 power = 1.0
    expect(powerLawNormalize(100, 100, 0.7)).toBe(1.0)
  })

  it('should clamp ratio at 1.0 when raw > maxInCohort', () => {
    // raw > max: shouldn't happen normally, but clamp defensively
    expect(powerLawNormalize(150, 100, 0.7)).toBe(1.0)
  })

  it('should treat negative raw as 0', () => {
    expect(powerLawNormalize(-50, 100, 0.7)).toBe(0)
  })

  it('should produce correct value for known inputs with power 0.7', () => {
    // ratio = 50/100 = 0.5, result = 0.5^0.7 ≈ 0.6156
    const expected = Math.pow(0.5, 0.7)
    expect(powerLawNormalize(50, 100, 0.7)).toBeCloseTo(expected, 6)
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
    expect(computeUpdateScore(true, 4)).toBeCloseTo(1.4, 6)
  })

  it('should cap streak bonus at 8 (submitted with streak 10 = 1.8)', () => {
    expect(computeUpdateScore(true, 10)).toBeCloseTo(1.8, 6)
  })

  it('should return 0.0 + streak bonus when not submitted', () => {
    expect(computeUpdateScore(false, 4)).toBeCloseTo(0.4, 6)
  })

  it('should return 0.0 for not submitted with 0 streak', () => {
    expect(computeUpdateScore(false, 0)).toBe(0.0)
  })

  it('should cap streak bonus at 0.8 regardless of submission', () => {
    expect(computeUpdateScore(true, 100)).toBeCloseTo(1.8, 6)
    expect(computeUpdateScore(false, 100)).toBeCloseTo(0.8, 6)
  })

  it('should return 1.8 for submitted with streak of exactly 8', () => {
    expect(computeUpdateScore(true, 8)).toBeCloseTo(1.8, 6)
  })

  it('should handle streak of 1 correctly', () => {
    expect(computeUpdateScore(true, 1)).toBeCloseTo(1.1, 6)
    expect(computeUpdateScore(false, 1)).toBeCloseTo(0.1, 6)
  })
})

// ── computeFavoriteMultiplier ────────────────────────────────────────

describe('computeFavoriteMultiplier', () => {
  it('should return exactly 1 for no favorites', () => {
    expect(computeFavoriteMultiplier([])).toBe(1)
  })

  it('should return 1.10 for a single favorite on day 0', () => {
    // 1 + 0.10 × exp(0) = 1.10
    expect(computeFavoriteMultiplier([{ daysAgo: 0 }])).toBeCloseTo(1.1, 6)
  })

  it('should return ~1.050 for a single favorite 7 days ago', () => {
    // 1 + 0.10 × exp(-0.1 × 7) ≈ 1 + 0.10 × 0.4966 ≈ 1.04966
    const expected = 1 + FAVORITE_WEIGHT * Math.exp(-FAVORITE_DECAY_RATE * 7)
    expect(computeFavoriteMultiplier([{ daysAgo: 7 }])).toBeCloseTo(expected, 6)
  })

  it('should return exactly 1 for a favorite 29 days ago (outside window)', () => {
    expect(computeFavoriteMultiplier([{ daysAgo: 29 }])).toBe(1)
  })

  it('should include a favorite exactly on the window boundary (day 28)', () => {
    // Day 28 is inclusive; day 29 is excluded
    const mult = computeFavoriteMultiplier([{ daysAgo: FAVORITE_WINDOW_DAYS }])
    expect(mult).toBeGreaterThan(1)
    expect(mult).toBeCloseTo(1 + FAVORITE_WEIGHT * Math.exp(-FAVORITE_DECAY_RATE * 28), 6)
  })

  it('should stack two favorites (day 0 + day 7) additively', () => {
    // 1 + 0.10 × (1 + exp(-0.7)) ≈ 1 + 0.10 × 1.4966 ≈ 1.1497
    const expected = 1 + FAVORITE_WEIGHT * (1 + Math.exp(-FAVORITE_DECAY_RATE * 7))
    expect(computeFavoriteMultiplier([{ daysAgo: 0 }, { daysAgo: 7 }])).toBeCloseTo(expected, 6)
  })

  it('should compute multiplier for 8 evenly-spaced favorites (max realistic)', () => {
    // 2/wk × 4 wks = 8 favorites. Spread them across the window.
    const favs = [0, 0, 7, 7, 14, 14, 21, 21].map((d) => ({ daysAgo: d }))
    const expected =
      1 +
      FAVORITE_WEIGHT * favs.reduce((sum, f) => sum + Math.exp(-FAVORITE_DECAY_RATE * f.daysAgo), 0)
    const mult = computeFavoriteMultiplier(favs)
    expect(mult).toBeCloseTo(expected, 6)
    // Sanity: should be around 1.37 for this spacing
    expect(mult).toBeGreaterThan(1.3)
    expect(mult).toBeLessThan(1.5)
  })

  it('should clamp negative daysAgo (future weekOf) to 0', () => {
    // daysAgo = -5 (admin manually set a future favorite) should behave
    // like day 0, not amplify beyond 1 + FAVORITE_WEIGHT.
    expect(computeFavoriteMultiplier([{ daysAgo: -5 }])).toBeCloseTo(1.1, 6)
  })

  it('should skip out-of-window favorites (continue branch, not break)', () => {
    // Guards against a regression that replaces `continue` with `break` —
    // that would stop iteration at the first out-of-window fav and drop
    // the in-window fav silently.
    const expected = 1 + FAVORITE_WEIGHT * 1.0 // only the day-0 fav contributes
    expect(computeFavoriteMultiplier([{ daysAgo: 0 }, { daysAgo: 30 }])).toBeCloseTo(expected, 6)
    expect(computeFavoriteMultiplier([{ daysAgo: 30 }, { daysAgo: 0 }])).toBeCloseTo(expected, 6)
  })
})

// ── computeLeaderboardScore ──────────────────────────────────────────

describe('computeLeaderboardScore', () => {
  it('1. full cohort, all 4 active: weighted sum matches hand calc', () => {
    // Each category raw=50 out of cohortMax=100. normalized = 0.5^0.7 ≈ 0.6156
    // weighted per cat = 0.6156 × 100 × WEIGHTS[key]
    // baseScore = Σ 0.6156 × 100 × 1.0 (sum of weights) = 61.56
    const raw = cat(50)
    const active = cat(true)
    const max = cat(100)
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [])
    const normExpected = Math.pow(0.5, 0.7) * 100
    const expectedBase = normExpected // sum of weights = 1.0
    expect(result.baseScore).toBeCloseTo(expectedBase, 2)
    expect(result.totalScore).toBeCloseTo(expectedBase, 2)
    expect(result.favoriteMultiplier).toBe(1)
    expect(result.activeCategories).toBe(4)
  })

  it('2. single active (only updates, raw=18, cohortMax=18): totalScore = 15', () => {
    const raw = cat(0, { updates: 18 })
    const active = cat(false, { updates: true })
    const max = cat(0, { updates: 18 })
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [])
    // normalized = (18/18)^0.7 × 100 = 100, weighted = 100 × 0.15 = 15
    expect(result.categories.updates.normalized).toBe(100)
    expect(result.categories.updates.weighted).toBeCloseTo(15, 6)
    expect(result.baseScore).toBeCloseTo(15, 6)
    expect(result.totalScore).toBeCloseTo(15, 6)
    expect(result.activeCategories).toBe(1)
    expect(result.qualified).toBe(false)
  })

  it('3. zero everywhere + zero active: totalScore === 0 exactly', () => {
    const raw = cat(0)
    const active = cat(false)
    const max = cat(0)
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [])
    expect(result.totalScore).toBe(0)
    expect(result.baseScore).toBe(0)
    expect(result.favoriteMultiplier).toBe(1)
    expect(result.activeCategories).toBe(0)
    expect(result.qualified).toBe(false)
  })

  it('4. revenue zero-to-positive growth: positive weighted contribution', () => {
    // Simulating caller: raw = computeGrowthRate(500, 0) = +100 (capped at 200)
    // summed with decay... caller responsibility. Here we just set raw = 100
    // for the category, cohortMax = 200.
    const raw = cat(0, { revenue: 100 })
    const active = cat(false, { revenue: true })
    const max = cat(0, { revenue: 200 })
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [])
    // normalized = (100/200)^0.7 × 100 = 0.6156 × 100 ≈ 61.56
    // weighted = 61.56 × 0.25 ≈ 15.39
    const normExpected = Math.pow(0.5, 0.7) * 100
    expect(result.categories.revenue.normalized).toBeCloseTo(normExpected, 3)
    expect(result.categories.revenue.weighted).toBeCloseTo(normExpected * WEIGHTS.revenue, 3)
    expect(result.totalScore).toBeGreaterThan(0)
  })

  it('5. growth caller caps at ±200% (documented; we verify cap value)', () => {
    // The cap lives in computeGrowthRate (separately tested). Here we
    // assert that a capped raw flows through normalize correctly.
    const raw = cat(0, { revenue: 200 })
    const active = cat(false, { revenue: true })
    const max = cat(0, { revenue: 200 })
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [])
    // Capped raw === max → normalized = 1.0 × 100 = 100
    expect(result.categories.revenue.normalized).toBe(100)
  })

  it('6. favorite this week (day 0): multiplier = 1.10', () => {
    const raw = cat(100)
    const active = cat(true)
    const max = cat(100)
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [{ daysAgo: 0 }])
    expect(result.favoriteMultiplier).toBeCloseTo(1.1, 6)
  })

  it('7. favorite 7 days ago: multiplier ≈ 1.05', () => {
    const raw = cat(100)
    const active = cat(true)
    const max = cat(100)
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [{ daysAgo: 7 }])
    const expected = 1 + FAVORITE_WEIGHT * Math.exp(-FAVORITE_DECAY_RATE * 7)
    expect(result.favoriteMultiplier).toBeCloseTo(expected, 6)
  })

  it('8. favorite 29 days ago (outside window): multiplier = 1.0', () => {
    const raw = cat(100)
    const active = cat(true)
    const max = cat(100)
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [{ daysAgo: 29 }])
    expect(result.favoriteMultiplier).toBe(1)
  })

  it('9. two favorites (day 0 + day 7) stack', () => {
    const raw = cat(100)
    const active = cat(true)
    const max = cat(100)
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [
      { daysAgo: 0 },
      { daysAgo: 7 },
    ])
    const expected = 1 + FAVORITE_WEIGHT * (1 + Math.exp(-FAVORITE_DECAY_RATE * 7))
    expect(result.favoriteMultiplier).toBeCloseTo(expected, 6)
  })

  it('10. eight favorites (2/wk × 4wk): multiplier ≈ 1.37', () => {
    const favs = [0, 0, 7, 7, 14, 14, 21, 21].map((d) => ({ daysAgo: d }))
    const raw = cat(100)
    const active = cat(true)
    const max = cat(100)
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, favs)
    expect(result.favoriteMultiplier).toBeGreaterThan(1.3)
    expect(result.favoriteMultiplier).toBeLessThan(1.5)
  })

  it('11. revenue at cohort max gets full revenue weight (normalized 100, weighted 35)', () => {
    const raw = cat(0, { revenue: 200 })
    const active = cat(false, { revenue: true })
    const max = cat(0, { revenue: 200 })
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [])
    expect(result.categories.revenue.normalized).toBe(100)
    expect(result.categories.revenue.weighted).toBeCloseTo(35, 6)
  })

  it('12. active gate: raw > 0 + inactive flag → weighted = 0', () => {
    // Simulates caller: revenue has MRR snapshots in window, but all weeks
    // have growth=0 (flat business). active=true but raw=0. Here we stage
    // the opposite: raw>0 but active=false (caller judged it inactive).
    const raw = cat(0, { revenue: 50 })
    const active = cat(false, { revenue: false })
    const max = cat(0, { revenue: 100 })
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [])
    // raw and normalized are visible for debugging, but weighted = 0
    expect(result.categories.revenue.raw).toBe(50)
    expect(result.categories.revenue.normalized).toBeGreaterThan(0)
    expect(result.categories.revenue.weighted).toBe(0)
    expect(result.baseScore).toBe(0)
  })

  it('13. active gate: raw = 0 + inactive flag → everything 0', () => {
    const raw = cat(0)
    const active = cat(false)
    const max = cat(100)
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [])
    expect(result.categories.revenue.raw).toBe(0)
    expect(result.categories.revenue.normalized).toBe(0)
    expect(result.categories.revenue.weighted).toBe(0)
  })

  it('14. activeCategories count matches sum of active flags', () => {
    const raw = cat(100)
    const active = cat(false, { revenue: true, traffic: true, github: true })
    const max = cat(100)
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [])
    expect(result.activeCategories).toBe(3)
  })

  it('15. qualified === (activeCategories >= 3)', () => {
    const raw = cat(100)
    const max = cat(100)
    // 2 active
    let r = computeLeaderboardScore(
      raw,
      cat(false, { revenue: true, traffic: true }),
      max,
      DEFAULT_CONFIG,
      []
    )
    expect(r.qualified).toBe(false)
    // 3 active
    r = computeLeaderboardScore(
      raw,
      cat(false, { revenue: true, traffic: true, github: true }),
      max,
      DEFAULT_CONFIG,
      []
    )
    expect(r.qualified).toBe(true)
  })

  it('16. negative daysAgo (future weekOf) clamps to 0', () => {
    const raw = cat(100)
    const active = cat(true)
    const max = cat(100)
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [{ daysAgo: -5 }])
    // Clamped to 0 → multiplier = 1.10 (same as day 0)
    expect(result.favoriteMultiplier).toBeCloseTo(1.1, 6)
  })

  it('17. cohortMax[key] = 0: normalized = 0 (no NaN, no divide-by-zero)', () => {
    const raw = cat(100)
    const active = cat(true)
    const max = cat(0) // zero cohort max everywhere
    const result = computeLeaderboardScore(raw, active, max, DEFAULT_CONFIG, [])
    for (const k of CATEGORY_KEYS) {
      expect(result.categories[k].normalized).toBe(0)
      expect(result.categories[k].weighted).toBe(0)
    }
    expect(result.totalScore).toBe(0)
    expect(Number.isNaN(result.totalScore)).toBe(false)
  })
})

// ── Constants sanity checks ──────────────────────────────────────────

describe('constants', () => {
  it('should have 4 category keys', () => {
    expect(CATEGORY_KEYS.length).toBe(4)
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
    expect(FAVORITE_WEIGHT).toBe(0.1)
    expect(FAVORITE_DECAY_RATE).toBe(0.1)
    expect(FAVORITE_WINDOW_DAYS).toBe(28)
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
    const calendar: TypedDayCounts = {
      [daysBeforeAsOf(0)]: { commits: 1, prs: 1, issues: 1 },
    }

    const score = computeVelocityScore(calendar, AS_OF)
    expect(score).toBe(COMMIT_PTS + PR_PTS + ISSUE_PTS)
    expect(score).toBe(50)
  })

  it('should return a breakdown whose per-type points sum to total (within rounding tolerance)', () => {
    const calendar: TypedDayCounts = {
      [daysBeforeAsOf(0)]: { commits: 3, prs: 1, issues: 2 },
      [daysBeforeAsOf(5)]: { commits: 0, prs: 2, issues: 0 },
      [daysBeforeAsOf(14)]: { commits: 5, prs: 0, issues: 1 },
      [daysBeforeAsOf(27)]: { commits: 1, prs: 1, issues: 1 },
    }

    const breakdown = computeVelocityBreakdown(calendar, AS_OF)
    const partsSum = breakdown.commits.points + breakdown.prs.points + breakdown.issues.points

    expect(Math.abs(partsSum - breakdown.total)).toBeLessThanOrEqual(1)

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

    expect(scoreDay0).toBe(10)
    expect(scoreDay27).toBe(Math.round(COMMIT_PTS * Math.exp(-DECAY_RATE * 27)))
    expect(scoreDay0).toBeGreaterThan(scoreDay27)

    const expectedRatio = Math.exp(-DECAY_RATE * 27)
    const actualRatio = scoreDay27 / scoreDay0
    expect(actualRatio).toBeCloseTo(expectedRatio, 1)
  })
})

describe('buildVelocityTimeSeries', () => {
  const AS_OF = new Date('2026-04-15T00:00:00.000Z')

  it('emits points immediately for a founder whose first contribution is inside 28 days', () => {
    const calendar: TypedDayCounts = {
      '2026-04-10': { commits: 0, prs: 1, issues: 0 },
    }

    const series = buildVelocityTimeSeries(calendar, undefined, AS_OF)

    expect(series).toHaveLength(6)
    expect(series[0]).toEqual({ timestamp: '2026-04-10T00:00:00.000Z', value: PR_PTS })
    expect(series.at(-1)).toEqual({
      timestamp: '2026-04-15T00:00:00.000Z',
      value: computeVelocityScore(calendar, AS_OF),
    })
  })

  it('honors startDate without inventing points before the first contribution', () => {
    const calendar: TypedDayCounts = {
      '2026-04-10': { commits: 1, prs: 0, issues: 0 },
    }

    expect(buildVelocityTimeSeries(calendar, '2026-04-01T00:00:00.000Z', AS_OF)[0]).toEqual({
      timestamp: '2026-04-10T00:00:00.000Z',
      value: COMMIT_PTS,
    })
    expect(buildVelocityTimeSeries(calendar, '2026-04-13T00:00:00.000Z', AS_OF)[0]).toEqual({
      timestamp: '2026-04-13T00:00:00.000Z',
      value: computeVelocityScore(calendar, new Date('2026-04-13T00:00:00.000Z')),
    })
  })
})
