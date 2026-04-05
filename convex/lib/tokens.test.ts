import { describe, it, expect } from 'bun:test'
import { generateToken, getExpiration } from './tokens'

describe('generateToken', () => {
  it('should return a string of length 43', () => {
    const token = generateToken()
    expect(token).toHaveLength(43)
  })

  it('should contain only URL-safe characters (A-Z, a-z, 0-9, -, _)', () => {
    const token = generateToken()
    expect(token).toMatch(/^[A-Za-z0-9\-_]+$/)
  })

  it('should produce different tokens on successive calls', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toBe(b)
  })
})

describe('getExpiration', () => {
  it('should return a valid ISO date string', () => {
    const iso = getExpiration(7)
    const parsed = new Date(iso)
    expect(parsed.toISOString()).toBe(iso)
  })

  it('should return a date N days in the future', () => {
    const now = new Date()
    const iso = getExpiration(7)
    const result = new Date(iso)

    const diffMs = result.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    // Allow a small tolerance for execution time (<1 second drift)
    expect(diffDays).toBeGreaterThan(6.999)
    expect(diffDays).toBeLessThan(7.001)
  })

  it("should return today's date when days is 0", () => {
    const now = new Date()
    const iso = getExpiration(0)
    const result = new Date(iso)

    expect(result.getUTCFullYear()).toBe(now.getUTCFullYear())
    expect(result.getUTCMonth()).toBe(now.getUTCMonth())
    expect(result.getUTCDate()).toBe(now.getUTCDate())
  })
})
