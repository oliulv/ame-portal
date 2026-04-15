// Pin TZ so the tests produce the same week boundaries regardless of
// the developer's or CI machine's local timezone. getMonday now uses
// UTC methods so this is belt-and-suspenders — if someone ever reverts
// that change, these tests will catch it on a non-UTC machine.
process.env.TZ = 'UTC'

import { describe, test, expect } from 'bun:test'
import { computeStreak } from './streak'
import { getMonday } from './dateUtils'

// Reference "now" in the middle of a week so deadline math is unambiguous.
// Wednesday 2026-04-15 12:00 UTC → currentWeek Monday = 2026-04-13
const NOW = new Date('2026-04-15T12:00:00.000Z')
const CURRENT = getMonday(NOW) // '2026-04-13'

function weeksBack(weeks: number): string {
  const d = new Date(CURRENT + 'T00:00:00.000Z')
  d.setUTCDate(d.getUTCDate() - weeks * 7)
  return d.toISOString().slice(0, 10)
}

describe('computeStreak', () => {
  test('empty weeklyUpdates → 0', () => {
    expect(computeStreak([], NOW)).toBe(0)
  })

  test('single submission last week → 1', () => {
    expect(computeStreak([{ weekOf: weeksBack(1) }], NOW)).toBe(1)
  })

  test('4 consecutive weeks including current week → 4', () => {
    const updates = [0, 1, 2, 3].map((i) => ({ weekOf: weeksBack(i) }))
    expect(computeStreak(updates, NOW)).toBe(4)
  })

  test('gap breaks streak — submissions at weeks 0,1 then gap at 2 → 2', () => {
    const updates = [0, 1, 3, 4].map((i) => ({ weekOf: weeksBack(i) }))
    expect(computeStreak(updates, NOW)).toBe(2)
  })

  test('current week submitted before deadline → includes current week', () => {
    // Early Monday of the current week — deadline for last week has not passed.
    const earlyMonday = new Date(CURRENT + 'T00:30:00.000Z')
    const updates = [{ weekOf: CURRENT }, { weekOf: weeksBack(1) }]
    expect(computeStreak(updates, earlyMonday)).toBe(2)
  })

  test('current week not submitted, deadline not passed → counts from last week', () => {
    // Mid-week: user has not yet submitted this week's update, but they still
    // have time. The streak should anchor on last week and not be penalised.
    const updates = [{ weekOf: weeksBack(1) }, { weekOf: weeksBack(2) }]
    expect(computeStreak(updates, NOW)).toBe(2)
  })

  test('current week not submitted, deadline passed → streak broken', () => {
    // Monday after this week's deadline (Monday 9am UTC of NEXT week).
    const nextMonday = new Date(weeksBack(-1) + 'T10:00:00.000Z')
    const updates = [{ weekOf: weeksBack(1) }, { weekOf: weeksBack(2) }]
    // At this point the "current week" for `nextMonday` is weeksBack(-1).
    // Last week relative to that is weeksBack(0) = CURRENT, which was NOT
    // submitted → streak breaks.
    expect(computeStreak(updates, nextMonday)).toBe(0)
  })

  test('10 consecutive weeks → returns actual count (streak is uncapped)', () => {
    const updates = Array.from({ length: 10 }, (_, i) => ({ weekOf: weeksBack(i) }))
    expect(computeStreak(updates, NOW)).toBe(10)
  })

  test('duplicate weekOf entries do not inflate streak', () => {
    const w = weeksBack(1)
    expect(computeStreak([{ weekOf: w }, { weekOf: w }], NOW)).toBe(1)
  })

  test('malformed weekOf values are ignored', () => {
    expect(
      computeStreak([{ weekOf: '' }, { weekOf: 'not-a-date' }, { weekOf: '2026-04' }], NOW)
    ).toBe(0)
  })

  test('malformed values mixed with valid ones only count the valid rows', () => {
    expect(
      computeStreak(
        [{ weekOf: weeksBack(1) }, { weekOf: 'garbage' }, { weekOf: weeksBack(2) }],
        NOW
      )
    ).toBe(2)
  })
})
