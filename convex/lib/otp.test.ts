import { describe, test, expect } from 'bun:test'
import { evaluateOtp, OTP_MAX_ATTEMPTS } from './otp'

const future = '2099-01-01T00:00:00Z'
const past = '2000-01-01T00:00:00Z'
const now = new Date('2026-04-22T00:00:00Z')
const H = 'a'.repeat(64) // stand-in for a SHA-256 hex

describe('evaluateOtp', () => {
  test('no code pending', () => {
    expect(evaluateOtp({}, H, now)).toEqual({ ok: false, reason: 'none', attempts: 0 })
    expect(evaluateOtp({ otpCodeHash: H }, H, now)).toEqual({
      ok: false,
      reason: 'none',
      attempts: 0,
    })
    expect(evaluateOtp({ otpExpiresAt: future }, H, now)).toEqual({
      ok: false,
      reason: 'none',
      attempts: 0,
    })
  })

  test('expired', () => {
    expect(evaluateOtp({ otpCodeHash: H, otpExpiresAt: past, otpAttempts: 1 }, H, now)).toEqual({
      ok: false,
      reason: 'expired',
      attempts: 1,
    })
  })

  test('locked at max attempts before any compare', () => {
    expect(
      evaluateOtp({ otpCodeHash: H, otpExpiresAt: future, otpAttempts: OTP_MAX_ATTEMPTS }, H, now)
    ).toEqual({ ok: false, reason: 'locked', attempts: OTP_MAX_ATTEMPTS })
  })

  test('ok for matching hash', () => {
    expect(evaluateOtp({ otpCodeHash: H, otpExpiresAt: future, otpAttempts: 0 }, H, now)).toEqual({
      ok: true,
    })
  })

  test('wrong bumps attempts counter', () => {
    expect(
      evaluateOtp({ otpCodeHash: H, otpExpiresAt: future, otpAttempts: 0 }, 'b'.repeat(64), now)
    ).toEqual({ ok: false, reason: 'wrong', attempts: 1 })
  })

  test('wrong at attempts=4 returns attempts=5 (invalidation trigger)', () => {
    const res = evaluateOtp(
      { otpCodeHash: H, otpExpiresAt: future, otpAttempts: 4 },
      'b'.repeat(64),
      now
    )
    expect(res).toEqual({ ok: false, reason: 'wrong', attempts: 5 })
  })

  test('custom max respected', () => {
    expect(
      evaluateOtp({ otpCodeHash: H, otpExpiresAt: future, otpAttempts: 2 }, H, now, 2)
    ).toEqual({ ok: false, reason: 'locked', attempts: 2 })
  })
})
