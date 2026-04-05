import { describe, it, expect } from 'bun:test'
import { slugify, generateUniqueSlug } from './slugify'

// ── slugify ─────────────────────────────────────────────────────────

describe('slugify', () => {
  it('should convert basic text to a slug', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('should lowercase all characters', () => {
    expect(slugify('UPPER CASE')).toBe('upper-case')
  })

  it('should remove accents via NFD normalization', () => {
    expect(slugify('Cafe\u0301 Tech')).toBe('cafe-tech')
    expect(slugify('Caf\u00e9 Tech')).toBe('cafe-tech')
  })

  it('should replace special characters with hyphens', () => {
    expect(slugify('foo@bar!baz')).toBe('foo-bar-baz')
  })

  it('should strip leading and trailing hyphens', () => {
    expect(slugify('---hello---')).toBe('hello')
  })

  it('should truncate to 50 characters and strip trailing hyphens from truncation', () => {
    const long = 'a'.repeat(60)
    const result = slugify(long)
    expect(result.length).toBeLessThanOrEqual(50)
    expect(result).toBe('a'.repeat(50))

    // When truncation lands in the middle of a hyphen sequence, trailing hyphens are removed
    const mixedLong = 'a'.repeat(49) + '---bbb'
    const mixedResult = slugify(mixedLong)
    expect(mixedResult.length).toBeLessThanOrEqual(50)
    expect(mixedResult.endsWith('-')).toBe(false)
  })

  it('should return empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('should pass through an already-valid slug unchanged', () => {
    expect(slugify('already-valid')).toBe('already-valid')
  })
})

// ── generateUniqueSlug ──────────────────────────────────────────────

describe('generateUniqueSlug', () => {
  it('should return the base slug when there are no collisions', () => {
    expect(generateUniqueSlug('my-slug', [])).toBe('my-slug')
  })

  it('should append -2 on first collision', () => {
    expect(generateUniqueSlug('my-slug', ['my-slug'])).toBe('my-slug-2')
  })

  it('should increment counter through multiple collisions', () => {
    const existing = ['my-slug', 'my-slug-2', 'my-slug-3']
    expect(generateUniqueSlug('my-slug', existing)).toBe('my-slug-4')
  })

  it('should return the base slug when existing array has unrelated slugs', () => {
    expect(generateUniqueSlug('my-slug', ['other-slug', 'another-one'])).toBe('my-slug')
  })
})
