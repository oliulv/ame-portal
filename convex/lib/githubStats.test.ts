import { describe, it, expect } from 'bun:test'
import {
  normalizeGithubStatsMeta,
  buildFounderTypedCalendar,
  buildTypedDayCountsFromSearchResults,
  sumTypedContributionCount,
  computeUnattributedContributionCount,
  buildContributionCalendarWeeksFromTypedDayCounts,
  type ContributionsInput,
} from './githubStats'

describe('normalizeGithubStatsMeta', () => {
  it('returns empty object for undefined input', () => {
    expect(normalizeGithubStatsMeta(undefined)).toEqual({})
  })

  it('returns empty object for empty input', () => {
    expect(normalizeGithubStatsMeta({})).toEqual({})
  })

  it('passes through a fully-populated row unchanged', () => {
    const input = { alice: { commits: 5, prs: 2, issues: 1, restricted: 3 } }
    expect(normalizeGithubStatsMeta(input)).toEqual(input)
  })

  it('defaults missing restricted to 0 (legacy row pre-restricted tracking)', () => {
    const input = { alice: { commits: 5, prs: 2, issues: 1 } }
    expect(normalizeGithubStatsMeta(input)).toEqual({
      alice: { commits: 5, prs: 2, issues: 1, restricted: 0 },
    })
  })

  it('defaults every missing numeric field to 0', () => {
    const input = { alice: {} }
    expect(normalizeGithubStatsMeta(input)).toEqual({
      alice: { commits: 0, prs: 0, issues: 0, restricted: 0 },
    })
  })

  it('handles multiple founders with mixed legacy and new shapes', () => {
    const input = {
      alice: { commits: 5, prs: 2, issues: 1, restricted: 3 },
      bob: { commits: 0, prs: 0, issues: 0 },
    }
    expect(normalizeGithubStatsMeta(input)).toEqual({
      alice: { commits: 5, prs: 2, issues: 1, restricted: 3 },
      bob: { commits: 0, prs: 0, issues: 0, restricted: 0 },
    })
  })
})

describe('buildFounderTypedCalendar', () => {
  it('returns an empty calendar when the response has no contributions', () => {
    const contrib: ContributionsInput = {
      commitContributionsByRepository: [],
      pullRequestContributions: { nodes: [] },
      issueContributions: { nodes: [] },
    }
    expect(buildFounderTypedCalendar(contrib)).toEqual({})
  })

  it('aggregates commits across repos into the right dates', () => {
    const contrib: ContributionsInput = {
      commitContributionsByRepository: [
        {
          contributions: {
            nodes: [
              { occurredAt: '2026-04-10T12:00:00Z', commitCount: 3 },
              { occurredAt: '2026-04-10T18:00:00Z', commitCount: 2 },
            ],
          },
        },
        {
          contributions: {
            nodes: [{ occurredAt: '2026-04-11T09:00:00Z', commitCount: 4 }],
          },
        },
      ],
    }
    expect(buildFounderTypedCalendar(contrib)).toEqual({
      '2026-04-10': { commits: 5, prs: 0, issues: 0 },
      '2026-04-11': { commits: 4, prs: 0, issues: 0 },
    })
  })

  it('counts each PR node as a single PR on its occurredAt date', () => {
    const contrib: ContributionsInput = {
      pullRequestContributions: {
        nodes: [
          { occurredAt: '2026-04-10T12:00:00Z' },
          { occurredAt: '2026-04-10T15:00:00Z' },
          { occurredAt: '2026-04-11T09:00:00Z' },
        ],
      },
    }
    expect(buildFounderTypedCalendar(contrib)).toEqual({
      '2026-04-10': { commits: 0, prs: 2, issues: 0 },
      '2026-04-11': { commits: 0, prs: 1, issues: 0 },
    })
  })

  it('counts each issue node as a single issue on its occurredAt date', () => {
    const contrib: ContributionsInput = {
      issueContributions: {
        nodes: [{ occurredAt: '2026-04-10T12:00:00Z' }],
      },
    }
    expect(buildFounderTypedCalendar(contrib)).toEqual({
      '2026-04-10': { commits: 0, prs: 0, issues: 1 },
    })
  })

  it('skips null repo nodes without throwing (restricted repo safety)', () => {
    // Real-world: GitHub returns null entries for repos the token can't read.
    // A single null node used to crash the entire founder's typed calendar.
    const contrib: ContributionsInput = {
      commitContributionsByRepository: [
        null,
        {
          contributions: {
            nodes: [{ occurredAt: '2026-04-10T00:00:00Z', commitCount: 3 }],
          },
        },
      ],
    }
    expect(buildFounderTypedCalendar(contrib)).toEqual({
      '2026-04-10': { commits: 3, prs: 0, issues: 0 },
    })
  })

  it('skips null PR nodes (restricted contributions)', () => {
    const contrib: ContributionsInput = {
      pullRequestContributions: {
        nodes: [null, { occurredAt: '2026-04-11T00:00:00Z' }, null],
      },
    }
    expect(buildFounderTypedCalendar(contrib)).toEqual({
      '2026-04-11': { commits: 0, prs: 1, issues: 0 },
    })
  })

  it('skips null issue nodes (restricted contributions)', () => {
    const contrib: ContributionsInput = {
      issueContributions: {
        nodes: [null, { occurredAt: '2026-04-12T00:00:00Z' }],
      },
    }
    expect(buildFounderTypedCalendar(contrib)).toEqual({
      '2026-04-12': { commits: 0, prs: 0, issues: 1 },
    })
  })

  it('skips nodes missing occurredAt even if the node itself is not null', () => {
    const contrib: ContributionsInput = {
      commitContributionsByRepository: [
        {
          contributions: {
            nodes: [
              { commitCount: 5 }, // missing occurredAt
              { occurredAt: '2026-04-10T00:00:00Z', commitCount: 2 },
            ],
          },
        },
      ],
      pullRequestContributions: {
        nodes: [{}, { occurredAt: '2026-04-11T00:00:00Z' }],
      },
      issueContributions: {
        nodes: [{}, { occurredAt: '2026-04-12T00:00:00Z' }],
      },
    }
    expect(buildFounderTypedCalendar(contrib)).toEqual({
      '2026-04-10': { commits: 2, prs: 0, issues: 0 },
      '2026-04-11': { commits: 0, prs: 1, issues: 0 },
      '2026-04-12': { commits: 0, prs: 0, issues: 1 },
    })
  })

  it('tolerates missing top-level fields (null/undefined on the GraphQL response)', () => {
    // When the App has zero installations and zero permissions, GitHub may
    // return top-level fields as null rather than empty arrays/objects.
    const contrib: ContributionsInput = {
      commitContributionsByRepository: null,
      pullRequestContributions: null,
      issueContributions: null,
    }
    expect(buildFounderTypedCalendar(contrib)).toEqual({})
  })

  it('does NOT reconcile against a merged-calendar total (anti-relabel guarantee)', () => {
    // Private-repo scenario: merged calendar would report contributions
    // happened, but the detailed nodes are empty because the App isn't
    // installed on those repos. The OLD reconciliation code dumped the
    // gap into `commits`, silently relabeling private PRs as commits.
    // This test locks in that we no longer do that.
    const contrib: ContributionsInput = {
      commitContributionsByRepository: [],
      pullRequestContributions: { nodes: [] },
      issueContributions: { nodes: [] },
    }
    const result = buildFounderTypedCalendar(contrib)
    expect(result).toEqual({})
    // Specifically: no date keys were invented, no synthetic commits added.
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('treats missing commitCount as 0 rather than NaN', () => {
    const contrib: ContributionsInput = {
      commitContributionsByRepository: [
        {
          contributions: {
            nodes: [{ occurredAt: '2026-04-10T00:00:00Z' }],
          },
        },
      ],
    }
    expect(buildFounderTypedCalendar(contrib)).toEqual({
      '2026-04-10': { commits: 0, prs: 0, issues: 0 },
    })
  })
})

describe('buildTypedDayCountsFromSearchResults', () => {
  it('aggregates mixed search hits by UTC day and type', () => {
    const typed = buildTypedDayCountsFromSearchResults({
      commits: [
        { occurredAt: '2026-04-10T12:00:00Z', count: 2 },
        { occurredAt: '2026-04-10T18:00:00Z' },
        { occurredAt: '2026-04-11T09:00:00Z' },
      ],
      prs: [
        { occurredAt: '2026-04-10T05:00:00Z' },
        { occurredAt: '2026-04-10T08:00:00Z' },
      ],
      issues: [{ occurredAt: '2026-04-11T03:00:00Z' }],
    })

    expect(typed).toEqual({
      '2026-04-10': { commits: 3, prs: 2, issues: 0 },
      '2026-04-11': { commits: 1, prs: 0, issues: 1 },
    })
  })

  it('skips hits missing occurredAt and clamps negative counts', () => {
    const typed = buildTypedDayCountsFromSearchResults({
      commits: [
        { count: 5 },
        { occurredAt: '2026-04-10T00:00:00Z', count: -3 },
      ],
      prs: [{ occurredAt: null }],
      issues: [{ occurredAt: '2026-04-11T00:00:00Z', count: 0 }],
    })

    expect(typed).toEqual({
      '2026-04-10': { commits: 0, prs: 0, issues: 0 },
      '2026-04-11': { commits: 0, prs: 0, issues: 0 },
    })
  })
})

describe('search-derived contribution helpers', () => {
  it('computes the residual between GitHub total and visible typed contributions', () => {
    const typed = buildTypedDayCountsFromSearchResults({
      commits: [{ occurredAt: '2026-04-10T00:00:00Z', count: 2 }],
      prs: [
        { occurredAt: '2026-04-10T01:00:00Z' },
        { occurredAt: '2026-04-11T01:00:00Z' },
      ],
      issues: [{ occurredAt: '2026-04-11T02:00:00Z' }],
    })

    expect(sumTypedContributionCount(typed)).toBe(5)
    expect(computeUnattributedContributionCount(9, typed)).toBe(4)
  })

  it('clamps unattributed contribution count at zero', () => {
    const typed = buildTypedDayCountsFromSearchResults({
      commits: [
        { occurredAt: '2026-04-10T00:00:00Z', count: 3 },
        { occurredAt: '2026-04-11T00:00:00Z', count: 4 },
      ],
    })

    expect(computeUnattributedContributionCount(5, typed)).toBe(0)
  })
})

describe('buildContributionCalendarWeeksFromTypedDayCounts', () => {
  it('returns Sunday-aligned weeks and zero-fills sparse ranges', () => {
    const typed = buildTypedDayCountsFromSearchResults({
      commits: [{ occurredAt: '2026-04-10T12:00:00Z', count: 2 }],
      prs: [{ occurredAt: '2026-04-14T09:00:00Z' }],
      issues: [{ occurredAt: '2026-04-14T10:00:00Z', count: 3 }],
    })

    const weeks = buildContributionCalendarWeeksFromTypedDayCounts(typed, {
      from: '2026-04-08',
      to: '2026-04-14',
    })

    expect(weeks).toHaveLength(2)
    expect(weeks[0].contributionDays?.map((d) => d.date)).toEqual([
      '2026-04-05',
      '2026-04-06',
      '2026-04-07',
      '2026-04-08',
      '2026-04-09',
      '2026-04-10',
      '2026-04-11',
    ])
    expect(weeks[1].contributionDays?.map((d) => d.date)).toEqual([
      '2026-04-12',
      '2026-04-13',
      '2026-04-14',
      '2026-04-15',
      '2026-04-16',
      '2026-04-17',
      '2026-04-18',
    ])
    expect(weeks[0].contributionDays?.find((d) => d.date === '2026-04-10')?.contributionCount).toBe(
      2
    )
    expect(weeks[1].contributionDays?.find((d) => d.date === '2026-04-14')?.contributionCount).toBe(
      4
    )
    expect(weeks[0].contributionDays?.find((d) => d.date === '2026-04-08')?.contributionCount).toBe(
      0
    )
  })

  it('returns an empty array for invalid ranges', () => {
    const typed = buildTypedDayCountsFromSearchResults({
      commits: [{ occurredAt: '2026-04-10T00:00:00Z' }],
    })

    expect(
      buildContributionCalendarWeeksFromTypedDayCounts(typed, {
        from: '2026-04-14',
        to: '2026-04-10',
      })
    ).toEqual([])
  })
})
