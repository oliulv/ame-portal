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
    expect(mixedResult).toBe('a'.repeat(49))
  })

  it('should collapse consecutive spaces into a single hyphen', () => {
    expect(slugify('foo  bar')).toBe('foo-bar')
  })

  it('should collapse consecutive special chars into a single hyphen', () => {
    expect(slugify('foo@@bar')).toBe('foo-bar')
  })

  it('should preserve numbers', () => {
    expect(slugify('Product 123')).toBe('product-123')
  })

  it('should replace underscores with hyphens', () => {
    expect(slugify('foo_bar')).toBe('foo-bar')
  })

  it('should strip emoji and unicode beyond accents', () => {
    expect(slugify('hello 🚀 world')).toBe('hello-world')
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

  it('should fill a gap in the collision sequence', () => {
    expect(generateUniqueSlug('my-slug', ['my-slug', 'my-slug-3'])).toBe('my-slug-2')
  })

  it('should handle base slug ending with a number', () => {
    expect(generateUniqueSlug('product-2', ['product-2'])).toBe('product-2-2')
  })

  it('should handle empty base slug with collision', () => {
    expect(generateUniqueSlug('', [''])).toBe('-2')
  })
})
