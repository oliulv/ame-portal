import { describe, test, expect } from 'bun:test'
import { computeBaseline, planSessionTrim } from './scrubMath'

describe('computeBaseline — happy path', () => {
  test('mean of preceding 7 days (only days with traffic)', () => {
    const dayCounts = [
      { date: '2026-04-10', count: 50 },
      { date: '2026-04-11', count: 60 },
      { date: '2026-04-12', count: 40 },
      { date: '2026-04-13', count: 70 },
      { date: '2026-04-14', count: 80 },
      { date: '2026-04-15', count: 30 },
      { date: '2026-04-16', count: 50 },
    ]
    const r = computeBaseline({ dayCounts, spikeDate: '2026-04-17', otherSpikeDates: [] })
    // (50+60+40+70+80+30+50)/7 = 380/7 = 54.28 → 54
    expect(r.baseline).toBe(54)
    expect(r.contributingDays).toHaveLength(7)
    expect(r.daysWithTraffic).toHaveLength(7)
    expect(r.excludedDays).toEqual([])
  })

  test('honours custom window (still requires minimum days-with-traffic)', () => {
    // 3 days with traffic, windowDays=3 → baseline = (50+100+200)/3 = 117.
    const dayCounts = [
      { date: '2026-04-14', count: 50 },
      { date: '2026-04-15', count: 100 },
      { date: '2026-04-16', count: 200 },
    ]
    const r = computeBaseline({
      dayCounts,
      spikeDate: '2026-04-17',
      otherSpikeDates: [],
      windowDays: 3,
    })
    expect(r.baseline).toBe(117)
    expect(r.contributingDays).toEqual(['2026-04-14', '2026-04-15', '2026-04-16'])
  })
})

describe('computeBaseline — exclude other spike dates', () => {
  test('redefine-me real case: 4/19 baseline excludes 4/17', () => {
    const dayCounts = [
      { date: '2026-04-12', count: 30 },
      { date: '2026-04-13', count: 50 },
      { date: '2026-04-14', count: 80 },
      { date: '2026-04-15', count: 30 },
      { date: '2026-04-16', count: 50 },
      { date: '2026-04-17', count: 607 }, // OTHER spike, must be excluded
      { date: '2026-04-18', count: 40 },
    ]
    const r = computeBaseline({
      dayCounts,
      spikeDate: '2026-04-19',
      otherSpikeDates: ['2026-04-17'],
    })
    // (30+50+80+30+50+40)/6 = 280/6 = 46.66 → 47, NOT polluted by 607
    expect(r.baseline).toBe(47)
    expect(r.excludedDays).toEqual(['2026-04-17'])
    expect(r.contributingDays).not.toContain('2026-04-17')
    expect(r.contributingDays).toHaveLength(6)
  })
})

describe('computeBaseline — sparse data refuses to wipe', () => {
  test('zero days with traffic → null baseline (too_sparse)', () => {
    const r = computeBaseline({ dayCounts: [], spikeDate: '2026-04-17', otherSpikeDates: [] })
    expect(r.baseline).toBeNull()
    expect(r.insufficientReason).toBe('too_sparse')
    expect(r.contributingDays).toHaveLength(7)
    expect(r.daysWithTraffic).toHaveLength(0)
  })

  test('1-2 days with traffic → null baseline (too_sparse)', () => {
    const dayCounts = [
      { date: '2026-04-15', count: 100 },
      { date: '2026-04-16', count: 100 },
    ]
    const r = computeBaseline({ dayCounts, spikeDate: '2026-04-17', otherSpikeDates: [] })
    // Below MIN_DAYS_WITH_TRAFFIC=3 → refuse, do not return baseline=29 like before.
    expect(r.baseline).toBeNull()
    expect(r.insufficientReason).toBe('too_sparse')
    expect(r.daysWithTraffic).toEqual(['2026-04-15', '2026-04-16'])
  })

  test('3 days with traffic → baseline computed from those 3 days only', () => {
    const dayCounts = [
      { date: '2026-04-14', count: 30 },
      { date: '2026-04-15', count: 60 },
      { date: '2026-04-16', count: 90 },
    ]
    const r = computeBaseline({ dayCounts, spikeDate: '2026-04-17', otherSpikeDates: [] })
    // (30+60+90)/3 = 60. Empty days are NOT counted as zero.
    expect(r.baseline).toBe(60)
    expect(r.daysWithTraffic).toHaveLength(3)
  })

  test('all days excluded → null baseline (no_window)', () => {
    const dayCounts = [{ date: '2026-04-16', count: 100 }]
    const r = computeBaseline({
      dayCounts,
      spikeDate: '2026-04-17',
      otherSpikeDates: [
        '2026-04-10',
        '2026-04-11',
        '2026-04-12',
        '2026-04-13',
        '2026-04-14',
        '2026-04-15',
        '2026-04-16',
      ],
    })
    expect(r.baseline).toBeNull()
    expect(r.insufficientReason).toBe('no_window')
    expect(r.contributingDays).toHaveLength(0)
    expect(r.excludedDays).toHaveLength(7)
  })
})

describe('computeBaseline — input validation', () => {
  test('throws on malformed spike date', () => {
    expect(() =>
      computeBaseline({ dayCounts: [], spikeDate: 'tomorrow', otherSpikeDates: [] })
    ).toThrow('invalid UTC day')
  })
})

describe('planSessionTrim — idempotent / no-op', () => {
  test('current count below baseline → empty plan', () => {
    const r = planSessionTrim({
      sessionGroups: [
        { sessionId: 'a', eventCount: 5 },
        { sessionId: 'b', eventCount: 3 },
      ],
      baseline: 10,
    })
    expect(r.sessionIdsToDelete).toEqual([])
    expect(r.remainingSessions).toBe(2)
    expect(r.eventsToDelete).toBe(0)
  })

  test('current count equals baseline → empty plan', () => {
    const r = planSessionTrim({
      sessionGroups: [
        { sessionId: 'a', eventCount: 5 },
        { sessionId: 'b', eventCount: 3 },
      ],
      baseline: 2,
    })
    expect(r.sessionIdsToDelete).toEqual([])
    expect(r.remainingSessions).toBe(2)
    expect(r.eventsToDelete).toBe(0)
  })
})

describe('planSessionTrim — picks largest clusters first', () => {
  test('one bot session of 1000 events, plus 5 real one-event sessions', () => {
    const r = planSessionTrim({
      sessionGroups: [
        { sessionId: 'bot', eventCount: 1000 },
        { sessionId: 'real-1', eventCount: 1 },
        { sessionId: 'real-2', eventCount: 1 },
        { sessionId: 'real-3', eventCount: 1 },
        { sessionId: 'real-4', eventCount: 1 },
        { sessionId: 'real-5', eventCount: 1 },
      ],
      baseline: 5,
    })
    expect(r.sessionIdsToDelete).toEqual(['bot'])
    expect(r.remainingSessions).toBe(5)
    expect(r.eventsToDelete).toBe(1000)
  })

  test('multiple bot sessions, picks the heaviest', () => {
    const r = planSessionTrim({
      sessionGroups: [
        { sessionId: 'bot-a', eventCount: 500 },
        { sessionId: 'bot-b', eventCount: 400 },
        { sessionId: 'bot-c', eventCount: 300 },
        { sessionId: 'real-1', eventCount: 2 },
        { sessionId: 'real-2', eventCount: 1 },
      ],
      baseline: 2,
    })
    expect(r.sessionIdsToDelete).toEqual(['bot-a', 'bot-b', 'bot-c'])
    expect(r.remainingSessions).toBe(2)
    expect(r.eventsToDelete).toBe(1200)
  })

  test('stable ordering on ties (sorts by sessionId asc as secondary)', () => {
    const r = planSessionTrim({
      sessionGroups: [
        { sessionId: 'zzz', eventCount: 5 },
        { sessionId: 'aaa', eventCount: 5 },
        { sessionId: 'mmm', eventCount: 5 },
        { sessionId: 'keep', eventCount: 1 },
      ],
      baseline: 1,
    })
    // Three same-size clusters, secondary sort = alphabetical
    expect(r.sessionIdsToDelete).toEqual(['aaa', 'mmm', 'zzz'])
    expect(r.remainingSessions).toBe(1)
  })
})

describe('planSessionTrim — empty + edge', () => {
  test('zero baseline removes everything', () => {
    const r = planSessionTrim({
      sessionGroups: [
        { sessionId: 'a', eventCount: 3 },
        { sessionId: 'b', eventCount: 4 },
      ],
      baseline: 0,
    })
    expect(r.sessionIdsToDelete.sort()).toEqual(['a', 'b'])
    expect(r.remainingSessions).toBe(0)
    expect(r.eventsToDelete).toBe(7)
  })

  test('empty input is a no-op', () => {
    const r = planSessionTrim({ sessionGroups: [], baseline: 50 })
    expect(r.sessionIdsToDelete).toEqual([])
    expect(r.remainingSessions).toBe(0)
    expect(r.eventsToDelete).toBe(0)
  })

  test('null baseline (insufficient data) refuses to delete', () => {
    const r = planSessionTrim({
      sessionGroups: [
        { sessionId: 'huge', eventCount: 9999 },
        { sessionId: 'small', eventCount: 1 },
      ],
      baseline: null,
    })
    // Even with an obvious bot, refuse to act when baseline is untrustworthy.
    expect(r.sessionIdsToDelete).toEqual([])
    expect(r.remainingSessions).toBe(2)
    expect(r.eventsToDelete).toBe(0)
  })
})

describe('integration: redefine-me 4/17 + 4/19 worked example', () => {
  test('4/17 spike (607) trims to baseline (~54)', () => {
    // Baseline window 4/10..4/16 with light traffic, no other spikes
    const dayCounts = [
      { date: '2026-04-10', count: 50 },
      { date: '2026-04-11', count: 60 },
      { date: '2026-04-12', count: 40 },
      { date: '2026-04-13', count: 70 },
      { date: '2026-04-14', count: 80 },
      { date: '2026-04-15', count: 30 },
      { date: '2026-04-16', count: 50 },
    ]
    const baselineRes = computeBaseline({
      dayCounts,
      spikeDate: '2026-04-17',
      otherSpikeDates: ['2026-04-19'],
    })
    expect(baselineRes.baseline).toBe(54)

    // Spike day: 1 huge bot session with 553 events + 54 real sessions
    const sessionGroups = [
      { sessionId: 'bot', eventCount: 553 },
      ...Array.from({ length: 54 }, (_, i) => ({
        sessionId: `real-${i}`,
        eventCount: 1,
      })),
    ]
    const trim = planSessionTrim({ sessionGroups, baseline: baselineRes.baseline })
    expect(trim.sessionIdsToDelete).toEqual(['bot'])
    expect(trim.remainingSessions).toBe(54)
    expect(trim.eventsToDelete).toBe(553)
  })
})
