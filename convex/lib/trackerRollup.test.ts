import { describe, expect, test } from 'bun:test'
import {
  TRACKER_ROLLUP_DAYS,
  buildTrackerDailyMetrics,
  trackerRollupWindow,
  utcDayKeyFromMs,
} from './trackerRollup'

describe('trackerRollupWindow', () => {
  test('returns 30 UTC days including today', () => {
    const now = Date.UTC(2026, 3, 24, 15, 30)
    const window = trackerRollupWindow(now)

    expect(utcDayKeyFromMs(window.startMs)).toBe('2026-03-26')
    expect(utcDayKeyFromMs(window.endMs - 1)).toBe('2026-04-24')
    expect((window.endMs - window.startMs) / 86_400_000).toBe(TRACKER_ROLLUP_DAYS)
  })
})

describe('buildTrackerDailyMetrics', () => {
  test('zero-fills days with no events', () => {
    const window = {
      startMs: Date.UTC(2026, 3, 22),
      endMs: Date.UTC(2026, 3, 25),
    }
    const metrics = buildTrackerDailyMetrics(
      [
        {
          _creationTime: Date.UTC(2026, 3, 22, 12),
          sessionId: 's1',
        },
      ],
      window
    )

    expect(metrics).toEqual([
      { metricKey: 'pageviews', value: 1, timestamp: '2026-04-22T00:00:00.000Z' },
      { metricKey: 'sessions', value: 1, timestamp: '2026-04-22T00:00:00.000Z' },
      {
        metricKey: 'weekly_active_users',
        value: 1,
        timestamp: '2026-04-22T00:00:00.000Z',
      },
      { metricKey: 'pageviews', value: 0, timestamp: '2026-04-23T00:00:00.000Z' },
      { metricKey: 'sessions', value: 0, timestamp: '2026-04-23T00:00:00.000Z' },
      {
        metricKey: 'weekly_active_users',
        value: 0,
        timestamp: '2026-04-23T00:00:00.000Z',
      },
      { metricKey: 'pageviews', value: 0, timestamp: '2026-04-24T00:00:00.000Z' },
      { metricKey: 'sessions', value: 0, timestamp: '2026-04-24T00:00:00.000Z' },
      {
        metricKey: 'weekly_active_users',
        value: 0,
        timestamp: '2026-04-24T00:00:00.000Z',
      },
    ])
  })

  test('uses UTC buckets and counts unique sessions', () => {
    const window = {
      startMs: Date.UTC(2026, 3, 22),
      endMs: Date.UTC(2026, 3, 24),
    }
    const metrics = buildTrackerDailyMetrics(
      [
        {
          _creationTime: Date.UTC(2026, 3, 22, 23, 59),
          sessionId: 's1',
        },
        {
          _creationTime: Date.UTC(2026, 3, 23, 0, 1),
          sessionId: 's1',
        },
        {
          _creationTime: Date.UTC(2026, 3, 23, 1),
          eventName: 'clicked_cta',
          sessionId: 's2',
        },
      ],
      window
    )

    expect(metrics.filter((m) => m.metricKey === 'pageviews')).toEqual([
      { metricKey: 'pageviews', value: 1, timestamp: '2026-04-22T00:00:00.000Z' },
      { metricKey: 'pageviews', value: 1, timestamp: '2026-04-23T00:00:00.000Z' },
    ])
    expect(metrics.filter((m) => m.metricKey === 'sessions')).toEqual([
      { metricKey: 'sessions', value: 1, timestamp: '2026-04-22T00:00:00.000Z' },
      { metricKey: 'sessions', value: 2, timestamp: '2026-04-23T00:00:00.000Z' },
    ])
  })
})
