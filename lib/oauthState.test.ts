import { describe, test, expect, beforeAll } from 'bun:test'
import { signState, verifyState } from './oauthState'

beforeAll(() => {
  process.env.OAUTH_STATE_SECRET = 'x'.repeat(48)
})

describe('oauthState', () => {
  test('round-trips payload', () => {
    const s = signState({ u: 'user_123' })
    expect(verifyState<{ u: string }>(s)?.u).toBe('user_123')
  })

  test('round-trips multi-field payload', () => {
    const s = signState({ u: 'user_123', s: 'startup_abc' })
    const out = verifyState<{ u: string; s: string }>(s)
    expect(out?.u).toBe('user_123')
    expect(out?.s).toBe('startup_abc')
  })

  test('rejects null / empty / malformed state', () => {
    expect(verifyState(null)).toBeNull()
    expect(verifyState(undefined)).toBeNull()
    expect(verifyState('')).toBeNull()
    expect(verifyState('no-dot')).toBeNull()
    expect(verifyState('.')).toBeNull()
    expect(verifyState('a.')).toBeNull()
    expect(verifyState('.b')).toBeNull()
  })

  test('rejects tampered body', () => {
    const s = signState({ u: 'user_123' })
    const sig = s.split('.')[1]
    const evilBody = Buffer.from(JSON.stringify({ u: 'attacker', e: 9e9 })).toString('base64url')
    expect(verifyState(`${evilBody}.${sig}`)).toBeNull()
  })

  test('rejects tampered signature', () => {
    const s = signState({ u: 'user_123' })
    const body = s.split('.')[0]
    expect(verifyState(`${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)).toBeNull()
  })

  test('rejects expired state', () => {
    const s = signState({ u: 'user_123' }, -1)
    expect(verifyState(s)).toBeNull()
  })

  test('rejects state signed with a different secret', () => {
    const s = signState({ u: 'user_123' })
    process.env.OAUTH_STATE_SECRET = 'y'.repeat(48)
    expect(verifyState(s)).toBeNull()
    process.env.OAUTH_STATE_SECRET = 'x'.repeat(48)
  })

  test('two states issued for the same payload differ (nonce)', () => {
    const a = signState({ u: 'user_123' })
    const b = signState({ u: 'user_123' })
    expect(a).not.toBe(b)
  })
})
