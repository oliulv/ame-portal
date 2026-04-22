import { describe, test, expect } from 'bun:test'
import {
  truncateIp,
  deriveSessionId,
  deriveIpHash,
  utcDayKey,
  TrackerIdentError,
  SecretMissingError,
} from './clientIdent'

const SECRET = 'test-secret-do-not-use-in-prod-aaaaaaaaaaaaaaaa'
const OTHER_SECRET = 'different-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

describe('utcDayKey', () => {
  test('formats YYYY-MM-DD', () => {
    expect(utcDayKey(0)).toBe('1970-01-01')
    // 2026-04-22 12:00 UTC
    expect(utcDayKey(Date.UTC(2026, 3, 22, 12, 0, 0))).toBe('2026-04-22')
    // 2026-04-22 00:00 UTC vs 2026-04-21 23:59:59
    expect(utcDayKey(Date.UTC(2026, 3, 22, 0, 0, 0))).toBe('2026-04-22')
    expect(utcDayKey(Date.UTC(2026, 3, 21, 23, 59, 59))).toBe('2026-04-21')
  })

  test('zero-pads single-digit month and day', () => {
    expect(utcDayKey(Date.UTC(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('truncateIp — IPv4', () => {
  test('passthrough for valid IPv4', () => {
    expect(truncateIp('1.2.3.4')).toBe('1.2.3.4')
    expect(truncateIp('255.255.255.255')).toBe('255.255.255.255')
    expect(truncateIp('0.0.0.0')).toBe('0.0.0.0')
  })

  test('strips whitespace', () => {
    expect(truncateIp('  10.0.0.1  ')).toBe('10.0.0.1')
  })

  test('rejects invalid octet', () => {
    expect(() => truncateIp('256.1.1.1')).toThrow(TrackerIdentError)
    expect(() => truncateIp('-1.1.1.1')).toThrow(TrackerIdentError)
  })
})

describe('truncateIp — IPv4-mapped IPv6', () => {
  test('unwraps to IPv4', () => {
    expect(truncateIp('::ffff:1.2.3.4')).toBe('1.2.3.4')
    expect(truncateIp('::FFFF:10.0.0.1')).toBe('10.0.0.1')
  })

  test('rejects mapped form with bad IPv4', () => {
    expect(() => truncateIp('::ffff:300.1.1.1')).toThrow(TrackerIdentError)
  })
})

describe('truncateIp — IPv6 /64 truncation', () => {
  test('keeps first four groups, zeros rest', () => {
    expect(truncateIp('2001:db8:abcd:0012:1:2:3:4')).toBe('2001:db8:abcd:0012::')
  })

  test('expands "::" mid-address before truncating', () => {
    expect(truncateIp('2001:db8::1')).toBe('2001:db8:0:0::')
  })

  test('expands "::" at start', () => {
    expect(truncateIp('::1')).toBe('0:0:0:0::')
  })

  test('lowercases', () => {
    expect(truncateIp('2001:DB8:ABCD:12:1:2:3:4')).toBe('2001:db8:abcd:12::')
  })

  test('rejects multiple "::"', () => {
    expect(() => truncateIp('2001::1::2')).toThrow(TrackerIdentError)
  })

  test('rejects bad group character', () => {
    expect(() => truncateIp('2001:zzzz::1')).toThrow(TrackerIdentError)
  })

  test('rejects oversize group', () => {
    expect(() => truncateIp('20011:db8::1')).toThrow(TrackerIdentError)
  })

  test('rejects too many groups', () => {
    expect(() => truncateIp('1:2:3:4:5:6:7:8:9')).toThrow(TrackerIdentError)
  })
})

describe('truncateIp — empty / malformed', () => {
  test('rejects empty', () => {
    expect(() => truncateIp('')).toThrow(TrackerIdentError)
    expect(() => truncateIp('   ')).toThrow(TrackerIdentError)
  })

  test('rejects gibberish', () => {
    expect(() => truncateIp('not-an-ip')).toThrow(TrackerIdentError)
    expect(() => truncateIp('hello.world')).toThrow(TrackerIdentError)
  })
})

describe('deriveSessionId', () => {
  const base = {
    ipTruncated: '1.2.3.4',
    userAgent: 'Mozilla/5.0',
    websiteId: 'site-abc',
    dayUtc: '2026-04-22',
    secret: SECRET,
  }

  test('deterministic for identical inputs', async () => {
    const a = await deriveSessionId(base)
    const b = await deriveSessionId(base)
    expect(a).toBe(b)
  })

  test('day rollover changes id', async () => {
    const a = await deriveSessionId(base)
    const b = await deriveSessionId({ ...base, dayUtc: '2026-04-23' })
    expect(a).not.toBe(b)
  })

  test('websiteId scopes id (cross-site separation)', async () => {
    const a = await deriveSessionId(base)
    const b = await deriveSessionId({ ...base, websiteId: 'site-xyz' })
    expect(a).not.toBe(b)
  })

  test('different user-agent yields different id', async () => {
    const a = await deriveSessionId(base)
    const b = await deriveSessionId({ ...base, userAgent: 'curl/8.0' })
    expect(a).not.toBe(b)
  })

  test('different IP yields different id', async () => {
    const a = await deriveSessionId(base)
    const b = await deriveSessionId({ ...base, ipTruncated: '5.6.7.8' })
    expect(a).not.toBe(b)
  })

  test('different secret yields different id (no cross-deploy linkability)', async () => {
    const a = await deriveSessionId(base)
    const b = await deriveSessionId({ ...base, secret: OTHER_SECRET })
    expect(a).not.toBe(b)
  })

  test('returns 64-char hex string', async () => {
    const id = await deriveSessionId(base)
    expect(id).toMatch(/^[0-9a-f]{64}$/)
  })

  test('throws on missing secret', async () => {
    await expect(deriveSessionId({ ...base, secret: '' })).rejects.toBeInstanceOf(
      SecretMissingError
    )
  })

  test('throws on missing ip', async () => {
    await expect(deriveSessionId({ ...base, ipTruncated: '' })).rejects.toBeInstanceOf(
      TrackerIdentError
    )
  })

  test('throws on missing websiteId', async () => {
    await expect(deriveSessionId({ ...base, websiteId: '' })).rejects.toBeInstanceOf(
      TrackerIdentError
    )
  })

  test('throws on missing dayUtc', async () => {
    await expect(deriveSessionId({ ...base, dayUtc: '' })).rejects.toBeInstanceOf(TrackerIdentError)
  })

  test('treats undefined user-agent as empty (still deterministic, no NaN-ish hash)', async () => {
    const id = await deriveSessionId({ ...base, userAgent: undefined as unknown as string })
    expect(id).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('deriveIpHash', () => {
  test('deterministic', async () => {
    const a = await deriveIpHash({ ipTruncated: '1.2.3.4', secret: SECRET })
    const b = await deriveIpHash({ ipTruncated: '1.2.3.4', secret: SECRET })
    expect(a).toBe(b)
  })

  test('different IPs differ', async () => {
    const a = await deriveIpHash({ ipTruncated: '1.2.3.4', secret: SECRET })
    const b = await deriveIpHash({ ipTruncated: '5.6.7.8', secret: SECRET })
    expect(a).not.toBe(b)
  })

  test('different secrets differ (no cross-deploy linkability)', async () => {
    const a = await deriveIpHash({ ipTruncated: '1.2.3.4', secret: SECRET })
    const b = await deriveIpHash({ ipTruncated: '1.2.3.4', secret: OTHER_SECRET })
    expect(a).not.toBe(b)
  })

  test('throws on missing secret', async () => {
    await expect(deriveIpHash({ ipTruncated: '1.2.3.4', secret: '' })).rejects.toBeInstanceOf(
      SecretMissingError
    )
  })

  test('throws on missing ip', async () => {
    await expect(deriveIpHash({ ipTruncated: '', secret: SECRET })).rejects.toBeInstanceOf(
      TrackerIdentError
    )
  })

  test('returns 64-char hex string', async () => {
    const h = await deriveIpHash({ ipTruncated: '1.2.3.4', secret: SECRET })
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  test('sessionId and ipHash differ for same inputs (different domain prefix)', async () => {
    const sid = await deriveSessionId({
      ipTruncated: '1.2.3.4',
      userAgent: '',
      websiteId: 'w',
      dayUtc: '2026-04-22',
      secret: SECRET,
    })
    const iph = await deriveIpHash({ ipTruncated: '1.2.3.4', secret: SECRET })
    expect(sid).not.toBe(iph)
  })
})
