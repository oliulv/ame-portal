import { describe, expect, test } from 'bun:test'
import { hostnameMatchesTrackerDomain, normalizeTrackerDomain } from './trackerDomain'

describe('normalizeTrackerDomain', () => {
  test('normalizes common pasted URL shapes', () => {
    expect(normalizeTrackerDomain('https://www.Example.com/path?x=1')).toBe('example.com')
    expect(normalizeTrackerDomain('example.com/landing')).toBe('example.com')
    expect(normalizeTrackerDomain('example.com.')).toBe('example.com')
    expect(normalizeTrackerDomain('*.example.com')).toBe('example.com')
  })

  test('keeps non-www subdomains specific', () => {
    expect(normalizeTrackerDomain('https://app.example.com/dashboard')).toBe('app.example.com')
  })

  test('returns undefined for blank input', () => {
    expect(normalizeTrackerDomain('   ')).toBeUndefined()
    expect(normalizeTrackerDomain(undefined)).toBeUndefined()
  })
})

describe('hostnameMatchesTrackerDomain', () => {
  test('matches apex, www, and subdomains', () => {
    expect(hostnameMatchesTrackerDomain('example.com', 'www.example.com')).toBe(true)
    expect(hostnameMatchesTrackerDomain('www.example.com', 'example.com')).toBe(true)
    expect(hostnameMatchesTrackerDomain('app.example.com', 'example.com')).toBe(true)
  })

  test('does not widen a specific subdomain to the apex domain', () => {
    expect(hostnameMatchesTrackerDomain('example.com', 'app.example.com')).toBe(false)
    expect(hostnameMatchesTrackerDomain('other.example.com', 'app.example.com')).toBe(false)
  })

  test('requires hostname when a domain is set', () => {
    expect(hostnameMatchesTrackerDomain(undefined, 'example.com')).toBe(false)
    expect(hostnameMatchesTrackerDomain('', 'example.com')).toBe(false)
  })
})
