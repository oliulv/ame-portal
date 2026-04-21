import { describe, it, expect } from 'bun:test'
import { classifyMilestoneForBackfill } from './classifyMilestoneForBackfill'

describe('classifyMilestoneForBackfill', () => {
  it('skips a milestone that is not approved', () => {
    const result = classifyMilestoneForBackfill({ status: 'submitted' }, [])
    expect(result).toEqual({ kind: 'skip-not-approved' })
  })

  it('skips a milestone that already has approvedAt', () => {
    const result = classifyMilestoneForBackfill(
      { status: 'approved', approvedAt: '2026-04-01T00:00:00.000Z' },
      []
    )
    expect(result).toEqual({ kind: 'skip-already-set' })
  })

  it('skips an approved milestone with no approval event', () => {
    const result = classifyMilestoneForBackfill({ status: 'approved' }, [
      { action: 'submitted', _creationTime: 1000 },
      { action: 'changes_requested', _creationTime: 2000 },
    ])
    expect(result).toEqual({ kind: 'skip-no-event' })
  })

  it('patches with the approval event creation time', () => {
    const result = classifyMilestoneForBackfill({ status: 'approved' }, [
      { action: 'submitted', _creationTime: 1000 },
      { action: 'approved', _creationTime: 2000 },
    ])
    expect(result).toEqual({
      kind: 'patch',
      approvedAt: new Date(2000).toISOString(),
    })
  })

  it('uses the latest approval event when multiple exist', () => {
    const result = classifyMilestoneForBackfill({ status: 'approved' }, [
      { action: 'approved', _creationTime: 1000 },
      { action: 'changes_requested', _creationTime: 1500 },
      { action: 'submitted', _creationTime: 2000 },
      { action: 'approved', _creationTime: 3000 },
    ])
    expect(result).toEqual({
      kind: 'patch',
      approvedAt: new Date(3000).toISOString(),
    })
  })

  it('is case-sensitive on action (Approved !== approved)', () => {
    // Guards against a future event producer writing 'Approved'/'APPROVED' —
    // those do NOT satisfy the backfill predicate.
    const result = classifyMilestoneForBackfill({ status: 'approved' }, [
      { action: 'Approved', _creationTime: 1000 },
      { action: 'APPROVED', _creationTime: 2000 },
    ])
    expect(result).toEqual({ kind: 'skip-no-event' })
  })

  it('deterministic output when two approved events share a _creationTime', () => {
    // Array#sort is stable in modern runtimes, so the first in input
    // order survives the reverse-sort tie. Pin this so a future refactor
    // to unstable sort or parallel resolve doesn't flip it.
    const result = classifyMilestoneForBackfill({ status: 'approved' }, [
      { action: 'approved', _creationTime: 5000 },
      { action: 'approved', _creationTime: 5000 },
    ])
    expect(result).toEqual({
      kind: 'patch',
      approvedAt: new Date(5000).toISOString(),
    })
  })

  it('invariant: every fixture classifies to exactly one bucket (patched + skipped = total)', () => {
    // Representative fixtures spanning every branch. This locks the
    // migration's log invariant (patched + skippedNotApproved + skippedAlreadySet
    // + skippedNoEvent === total) without needing a convex-test harness.
    const fixtures = [
      // 1: patch (approved + has approval event)
      {
        milestone: { status: 'approved' as const },
        events: [{ action: 'approved', _creationTime: 1000 }],
        expectKind: 'patch',
      },
      // 2: skip-not-approved (status=submitted)
      {
        milestone: { status: 'submitted' as const },
        events: [],
        expectKind: 'skip-not-approved',
      },
      // 3: skip-already-set (approvedAt populated)
      {
        milestone: { status: 'approved' as const, approvedAt: '2026-01-01T00:00:00.000Z' },
        events: [{ action: 'approved', _creationTime: 999 }],
        expectKind: 'skip-already-set',
      },
      // 4: skip-no-event (approved but no approval event in events list)
      {
        milestone: { status: 'approved' as const },
        events: [{ action: 'submitted', _creationTime: 1000 }],
        expectKind: 'skip-no-event',
      },
      // 5: skip-not-approved (status=waiting)
      {
        milestone: { status: 'waiting' as const },
        events: [{ action: 'approved', _creationTime: 1000 }],
        expectKind: 'skip-not-approved',
      },
    ]

    const counts = { patch: 0, 'skip-not-approved': 0, 'skip-already-set': 0, 'skip-no-event': 0 }
    for (const f of fixtures) {
      const result = classifyMilestoneForBackfill(f.milestone, f.events)
      expect(result.kind).toBe(f.expectKind as any)
      counts[result.kind]++
    }
    const total =
      counts.patch +
      counts['skip-not-approved'] +
      counts['skip-already-set'] +
      counts['skip-no-event']
    expect(total).toBe(fixtures.length)
    // Also assert each bucket has the expected fixture count.
    expect(counts.patch).toBe(1)
    expect(counts['skip-not-approved']).toBe(2)
    expect(counts['skip-already-set']).toBe(1)
    expect(counts['skip-no-event']).toBe(1)
  })
})
