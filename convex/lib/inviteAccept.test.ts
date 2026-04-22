import { describe, test, expect } from 'bun:test'
import { evaluateInviteAccept } from './inviteAccept'

const now = new Date('2026-04-22T00:00:00Z')
const base = { email: 'a@example.com', expiresAt: '2099-01-01T00:00:00Z' }

describe('evaluateInviteAccept', () => {
  test('missing clerk email → wrong_email', () => {
    expect(evaluateInviteAccept(base, undefined, now)).toEqual({
      ok: false,
      reason: 'wrong_email',
    })
    expect(evaluateInviteAccept(base, null, now)).toEqual({
      ok: false,
      reason: 'wrong_email',
    })
    expect(evaluateInviteAccept(base, '', now)).toEqual({
      ok: false,
      reason: 'wrong_email',
    })
  })

  test('mismatched email → wrong_email', () => {
    expect(evaluateInviteAccept(base, 'b@example.com', now)).toEqual({
      ok: false,
      reason: 'wrong_email',
    })
  })

  test('case-insensitive match → ok', () => {
    expect(evaluateInviteAccept(base, 'A@EXAMPLE.COM', now)).toEqual({ ok: true })
    expect(evaluateInviteAccept(base, 'a@example.com', now)).toEqual({ ok: true })
  })

  test('already accepted → already_accepted', () => {
    expect(
      evaluateInviteAccept({ ...base, acceptedAt: '2025-01-01' }, 'a@example.com', now)
    ).toEqual({ ok: false, reason: 'already_accepted' })
  })

  test('expired → expired', () => {
    expect(
      evaluateInviteAccept({ ...base, expiresAt: '2020-01-01T00:00:00Z' }, 'a@example.com', now)
    ).toEqual({ ok: false, reason: 'expired' })
  })

  test('wrong_email wins over acceptedAt/expired (prevents info leak)', () => {
    expect(
      evaluateInviteAccept(
        { ...base, acceptedAt: '2025-01-01', expiresAt: '2020-01-01T00:00:00Z' },
        'attacker@example.com',
        now
      )
    ).toEqual({ ok: false, reason: 'wrong_email' })
  })
})
