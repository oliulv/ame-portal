import { describe, it, expect } from 'bun:test'
import { normalizeToMonthlyCents, computeMrrMovements } from './stripeMrr'
import type { MrrMovement } from './stripeMrr'

// ── normalizeToMonthlyCents ─────────────────────────────────────────

describe('normalizeToMonthlyCents', () => {
  describe('monthly interval', () => {
    it('should return amountCents unchanged for intervalCount=1', () => {
      expect(normalizeToMonthlyCents(1000, 'month', 1)).toBe(1000)
    })

    it('should divide by intervalCount for multi-month intervals', () => {
      // $20 every 2 months = $10/month
      expect(normalizeToMonthlyCents(2000, 'month', 2)).toBe(1000)
    })

    it('should handle intervalCount=3 (quarterly)', () => {
      // $30 every 3 months = $10/month
      expect(normalizeToMonthlyCents(3000, 'month', 3)).toBe(1000)
    })

    it('should handle intervalCount=6 (semi-annual)', () => {
      // $6000 every 6 months = $1000/month
      expect(normalizeToMonthlyCents(6000, 'month', 6)).toBe(1000)
    })
  })

  describe('yearly interval', () => {
    it('should divide by 12 for intervalCount=1', () => {
      // $120/year = $10/month
      expect(normalizeToMonthlyCents(12000, 'year', 1)).toBe(1000)
    })

    it('should divide by 12*intervalCount for multi-year intervals', () => {
      // $24000 every 2 years = $1000/month
      expect(normalizeToMonthlyCents(24000, 'year', 2)).toBe(1000)
    })
  })

  describe('weekly interval', () => {
    it('should multiply by 52/12 for intervalCount=1', () => {
      // $100/week * 52/12 = ~$433.33/month
      const result = normalizeToMonthlyCents(100, 'week', 1)
      expect(result).toBeCloseTo(100 * (52 / 12), 5)
    })

    it('should divide by intervalCount first then multiply by 52/12', () => {
      // $200 every 2 weeks -> (200/2) * (52/12) = 100 * 4.333... = ~433.33
      const result = normalizeToMonthlyCents(200, 'week', 2)
      expect(result).toBeCloseTo((200 / 2) * (52 / 12), 5)
    })
  })

  describe('daily interval', () => {
    it('should multiply by 365/12 for intervalCount=1', () => {
      // $10/day * 365/12 = ~$304.17/month
      const result = normalizeToMonthlyCents(10, 'day', 1)
      expect(result).toBeCloseTo(10 * (365 / 12), 5)
    })

    it('should divide by intervalCount first then multiply by 365/12', () => {
      // $30 every 3 days -> (30/3) * (365/12) = 10 * 30.4167 = ~304.17
      const result = normalizeToMonthlyCents(30, 'day', 3)
      expect(result).toBeCloseTo((30 / 3) * (365 / 12), 5)
    })
  })

  describe('unknown interval', () => {
    it('should return amountCents unchanged for unknown interval string', () => {
      expect(normalizeToMonthlyCents(5000, 'quarter', 1)).toBe(5000)
    })

    it('should return amountCents for empty string interval', () => {
      expect(normalizeToMonthlyCents(5000, '', 1)).toBe(5000)
    })
  })

  describe('edge cases', () => {
    it('should handle 0 amount', () => {
      expect(normalizeToMonthlyCents(0, 'month', 1)).toBe(0)
      expect(normalizeToMonthlyCents(0, 'year', 1)).toBe(0)
      expect(normalizeToMonthlyCents(0, 'week', 1)).toBe(0)
      expect(normalizeToMonthlyCents(0, 'day', 1)).toBe(0)
    })

    it('should handle very large amounts', () => {
      // $1,000,000/year = ~$83,333.33/month
      const result = normalizeToMonthlyCents(100_000_000, 'year', 1)
      expect(result).toBeCloseTo(100_000_000 / 12, 5)
    })

    it('should handle fractional results for yearly', () => {
      // $100/year = $8.333.../month
      const result = normalizeToMonthlyCents(100, 'year', 1)
      expect(result).toBeCloseTo(100 / 12, 5)
    })
  })
})

// ── computeMrrMovements ─────────────────────────────────────────────

describe('computeMrrMovements', () => {
  function findMovement(movements: MrrMovement[], customerId: string): MrrMovement | undefined {
    return movements.find((m) => m.stripeCustomerId === customerId)
  }

  describe('new customers', () => {
    it("should classify as 'new' when customer is in current but not in previous and not in allTime", () => {
      const current = new Map([['cus_new', 5000]])
      const previous = new Map<string, number>()
      const allTime = new Set<string>()

      const movements = computeMrrMovements(current, previous, allTime)

      expect(movements).toHaveLength(1)
      expect(movements[0].type).toBe('new')
      expect(movements[0].amount).toBe(5000)
      expect(movements[0].stripeCustomerId).toBe('cus_new')
    })

    it('should detect multiple new customers', () => {
      const current = new Map([
        ['cus_a', 1000],
        ['cus_b', 2000],
      ])
      const previous = new Map<string, number>()
      const allTime = new Set<string>()

      const movements = computeMrrMovements(current, previous, allTime)

      expect(movements).toHaveLength(2)
      expect(movements.every((m) => m.type === 'new')).toBe(true)
    })
  })

  describe('reactivation', () => {
    it("should classify as 'reactivation' when customer is in current, not in previous, but IS in allTime", () => {
      const current = new Map([['cus_returning', 3000]])
      const previous = new Map<string, number>()
      const allTime = new Set(['cus_returning'])

      const movements = computeMrrMovements(current, previous, allTime)

      expect(movements).toHaveLength(1)
      expect(movements[0].type).toBe('reactivation')
      expect(movements[0].amount).toBe(3000)
      expect(movements[0].stripeCustomerId).toBe('cus_returning')
    })

    it("should classify as 'reactivation' when customer had 0 MRR in previous but is in allTime", () => {
      const current = new Map([['cus_returning', 3000]])
      const previous = new Map([['cus_returning', 0]])
      const allTime = new Set(['cus_returning'])

      const movements = computeMrrMovements(current, previous, allTime)

      expect(movements).toHaveLength(1)
      expect(movements[0].type).toBe('reactivation')
      expect(movements[0].amount).toBe(3000)
    })
  })

  describe('churn', () => {
    it("should classify as 'churn' when customer is in previous but not in current", () => {
      const current = new Map<string, number>()
      const previous = new Map([['cus_churned', 4000]])
      const allTime = new Set(['cus_churned'])

      const movements = computeMrrMovements(current, previous, allTime)

      expect(movements).toHaveLength(1)
      expect(movements[0].type).toBe('churn')
      expect(movements[0].amount).toBe(4000)
      expect(movements[0].stripeCustomerId).toBe('cus_churned')
    })

    it("should classify as 'churn' when customer current MRR is 0 but previous was positive", () => {
      const current = new Map([['cus_churned', 0]])
      const previous = new Map([['cus_churned', 4000]])
      const allTime = new Set(['cus_churned'])

      const movements = computeMrrMovements(current, previous, allTime)

      expect(movements).toHaveLength(1)
      expect(movements[0].type).toBe('churn')
      expect(movements[0].amount).toBe(4000)
    })
  })

  describe('expansion', () => {
    it("should classify as 'expansion' when current MRR > previous MRR", () => {
      const current = new Map([['cus_expand', 8000]])
      const previous = new Map([['cus_expand', 5000]])
      const allTime = new Set(['cus_expand'])

      const movements = computeMrrMovements(current, previous, allTime)

      expect(movements).toHaveLength(1)
      expect(movements[0].type).toBe('expansion')
      expect(movements[0].amount).toBe(3000) // delta
      expect(movements[0].stripeCustomerId).toBe('cus_expand')
    })
  })

  describe('contraction', () => {
    it("should classify as 'contraction' when current MRR < previous MRR and current > 0", () => {
      const current = new Map([['cus_contract', 3000]])
      const previous = new Map([['cus_contract', 5000]])
      const allTime = new Set(['cus_contract'])

      const movements = computeMrrMovements(current, previous, allTime)

      expect(movements).toHaveLength(1)
      expect(movements[0].type).toBe('contraction')
      expect(movements[0].amount).toBe(2000) // delta
      expect(movements[0].stripeCustomerId).toBe('cus_contract')
    })

    it("should NOT classify as 'contraction' when current is 0 (that is churn)", () => {
      const current = new Map([['cus_gone', 0]])
      const previous = new Map([['cus_gone', 5000]])
      const allTime = new Set(['cus_gone'])

      const movements = computeMrrMovements(current, previous, allTime)

      expect(movements).toHaveLength(1)
      expect(movements[0].type).toBe('churn')
    })
  })

  describe('no change', () => {
    it('should produce no movement when current equals previous', () => {
      const current = new Map([['cus_steady', 5000]])
      const previous = new Map([['cus_steady', 5000]])
      const allTime = new Set(['cus_steady'])

      const movements = computeMrrMovements(current, previous, allTime)

      expect(movements).toHaveLength(0)
    })

    it('should produce no movement when customer has 0 MRR in both periods', () => {
      const current = new Map([['cus_zero', 0]])
      const previous = new Map([['cus_zero', 0]])
      const allTime = new Set(['cus_zero'])

      const movements = computeMrrMovements(current, previous, allTime)

      expect(movements).toHaveLength(0)
    })
  })

  describe('empty maps', () => {
    it('should return empty movements for empty maps', () => {
      const current = new Map<string, number>()
      const previous = new Map<string, number>()
      const allTime = new Set<string>()

      const movements = computeMrrMovements(current, previous, allTime)

      expect(movements).toHaveLength(0)
    })
  })

  describe('mixed scenarios', () => {
    it('should correctly classify multiple simultaneous movement types', () => {
      const current = new Map([
        ['cus_new', 1000], // new
        ['cus_returning', 2000], // reactivation (in allTime)
        ['cus_expand', 8000], // expansion (was 5000)
        ['cus_contract', 3000], // contraction (was 5000)
        ['cus_steady', 4000], // no change
        // cus_churned is missing -> churn
      ])
      const previous = new Map([
        ['cus_expand', 5000],
        ['cus_contract', 5000],
        ['cus_steady', 4000],
        ['cus_churned', 6000],
      ])
      const allTime = new Set([
        'cus_returning',
        'cus_expand',
        'cus_contract',
        'cus_steady',
        'cus_churned',
      ])

      const movements = computeMrrMovements(current, previous, allTime)

      expect(movements).toHaveLength(5)

      const newM = findMovement(movements, 'cus_new')
      expect(newM?.type).toBe('new')
      expect(newM?.amount).toBe(1000)

      const reactivation = findMovement(movements, 'cus_returning')
      expect(reactivation?.type).toBe('reactivation')
      expect(reactivation?.amount).toBe(2000)

      const expansion = findMovement(movements, 'cus_expand')
      expect(expansion?.type).toBe('expansion')
      expect(expansion?.amount).toBe(3000)

      const contraction = findMovement(movements, 'cus_contract')
      expect(contraction?.type).toBe('contraction')
      expect(contraction?.amount).toBe(2000)

      const churn = findMovement(movements, 'cus_churned')
      expect(churn?.type).toBe('churn')
      expect(churn?.amount).toBe(6000)

      // cus_steady should NOT appear in movements
      const steady = findMovement(movements, 'cus_steady')
      expect(steady).toBeUndefined()
    })
  })
})
