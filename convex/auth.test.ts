import { describe, test, expect } from 'bun:test'
import { permissionRowsGrantAccess } from './auth'
import type { Id } from './_generated/dataModel'

// Opaque Id<'startups'> values — we only compare by equality in the tests.
const S1 = 'startup_one' as Id<'startups'>
const S2 = 'startup_two' as Id<'startups'>

describe('permissionRowsGrantAccess', () => {
  test('no rows → denies', () => {
    expect(permissionRowsGrantAccess([])).toBe(false)
    expect(permissionRowsGrantAccess([], S1)).toBe(false)
  })

  test('cohort-wide grant (startupId undefined) + no startupId arg → allows', () => {
    expect(permissionRowsGrantAccess([{}])).toBe(true)
  })

  test('cohort-wide grant + startupId arg → allows', () => {
    expect(permissionRowsGrantAccess([{}], S1)).toBe(true)
  })

  test('startup-scoped grant + matching startupId → allows', () => {
    expect(permissionRowsGrantAccess([{ startupId: S1 }], S1)).toBe(true)
  })

  test('startup-scoped grant + mismatching startupId → denies', () => {
    expect(permissionRowsGrantAccess([{ startupId: S1 }], S2)).toBe(false)
  })

  test('startup-scoped grant + no startupId arg → denies (critical: no over-permit)', () => {
    expect(permissionRowsGrantAccess([{ startupId: S1 }])).toBe(false)
  })

  test('mixed rows (cohort-wide + startup-scoped) → cohort-wide wins', () => {
    expect(permissionRowsGrantAccess([{ startupId: S1 }, {}], S2)).toBe(true)
  })

  test('multiple startup-scoped grants → match any', () => {
    expect(permissionRowsGrantAccess([{ startupId: S1 }, { startupId: S2 }], S2)).toBe(true)
    expect(
      permissionRowsGrantAccess(
        [{ startupId: S1 }, { startupId: S2 }],
        'startup_three' as Id<'startups'>
      )
    ).toBe(false)
  })
})
