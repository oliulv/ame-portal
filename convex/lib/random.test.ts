import { describe, test, expect } from 'bun:test'
import {
  randomBytes,
  randomIntBelow,
  randomNumericCode,
  randomToken,
  timingSafeEqual,
  sha256Hex,
} from './random'

describe('randomBytes', () => {
  test('returns requested length', () => {
    expect(randomBytes(16).length).toBe(16)
    expect(randomBytes(0).length).toBe(0)
    expect(randomBytes(64).length).toBe(64)
  })

  test('two draws differ', () => {
    const a = randomBytes(32)
    const b = randomBytes(32)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
  })
})

describe('randomToken', () => {
  test('matches expected length and alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const t = randomToken(43)
      expect(t).toHaveLength(43)
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/)
    }
  })

  test('honours custom length', () => {
    expect(randomToken(8)).toHaveLength(8)
    expect(randomToken(1)).toHaveLength(1)
  })
})

describe('randomIntBelow', () => {
  test('stays in [0, max)', () => {
    for (let i = 0; i < 10_000; i++) {
      const n = randomIntBelow(17)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(17)
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  test('rejects invalid max', () => {
    expect(() => randomIntBelow(0)).toThrow()
    expect(() => randomIntBelow(-1)).toThrow()
    expect(() => randomIntBelow(1.5)).toThrow()
  })

  test('covers full range (statistical)', () => {
    const counts = new Array(10).fill(0)
    for (let i = 0; i < 10_000; i++) counts[randomIntBelow(10)]++
    // Every bucket should be hit in 10k draws
    for (const c of counts) expect(c).toBeGreaterThan(0)
  })
})

describe('randomNumericCode', () => {
  test('fixed digit count, zero-padded', () => {
    for (let i = 0; i < 200; i++) {
      const c = randomNumericCode(6)
      expect(c).toMatch(/^\d{6}$/)
    }
  })

  test('rejects out-of-range digit counts', () => {
    expect(() => randomNumericCode(0)).toThrow()
    expect(() => randomNumericCode(10)).toThrow()
  })
})

describe('timingSafeEqual', () => {
  test('true for equal strings', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
    expect(timingSafeEqual('', '')).toBe(true)
  })

  test('false for different strings', () => {
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
    expect(timingSafeEqual('abc', 'ab')).toBe(false)
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('sha256Hex', () => {
  test('known vectors', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })

  test('differs for different inputs', async () => {
    expect(await sha256Hex('a')).not.toBe(await sha256Hex('b'))
  })
})
