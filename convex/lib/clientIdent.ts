// Client fingerprinting for the public tracker endpoint.
//
// The tracker collect handler must derive a stable per-day session id from
// the requester's IP so a malicious script cannot mint sessions by rotating
// client-supplied identifiers. WebCrypto only — this file is imported by
// Convex isolate code, never by Node-only contexts.

export class TrackerIdentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TrackerIdentError'
  }
}

export class SecretMissingError extends Error {
  constructor(name: string) {
    super(`Required secret "${name}" is not set`)
    this.name = 'SecretMissingError'
  }
}

/** UTC day key in `YYYY-MM-DD` form. */
export function utcDayKey(epochMs: number = Date.now()): string {
  const d = new Date(epochMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── IP truncation ─────────────────────────────────────────────────────
//
//  - IPv4 passes through.
//  - IPv4-mapped IPv6 ("::ffff:1.2.3.4") unwraps to its IPv4 form so
//    a dual-stack client and a v4-only client behind the same NAT collapse.
//  - IPv6 truncates to /64 (first four 16-bit groups), zeroing the rest.
//    Privacy-extension /128 rotation collapses to a single fingerprint.
//  - Anything we can't recognize throws — the handler then fails closed.

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
const IPV4_MAPPED_RE = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i

/** Hard cap on IP header length. Anything longer is malformed or hostile. */
const MAX_IP_LENGTH = 64
/** Hard cap on user-agent string length used in session derivation. Longer
 * UAs are truncated; this prevents an attacker from burning CPU on multi-MB
 * Mozilla strings. 512 chars covers every real browser UA. */
export const MAX_UA_LENGTH = 512

export function truncateIp(ip: string): string {
  const trimmed = (ip ?? '').trim()
  if (!trimmed) throw new TrackerIdentError('empty IP')
  if (trimmed.length > MAX_IP_LENGTH) {
    throw new TrackerIdentError(`IP too long (${trimmed.length} chars)`)
  }

  const mapped = IPV4_MAPPED_RE.exec(trimmed)
  if (mapped) return canonicalizeIpv4(mapped[1])

  if (IPV4_RE.test(trimmed)) return canonicalizeIpv4(trimmed)

  if (trimmed.includes(':')) return truncateIpv6To64(trimmed)

  throw new TrackerIdentError(`unrecognized IP format: ${trimmed}`)
}

/** Validates and canonicalizes an IPv4 address. Strips leading zeros so
 * "01.02.03.04" and "1.2.3.4" hash to the same fingerprint. */
function canonicalizeIpv4(addr: string): string {
  const parts = addr.split('.')
  if (parts.length !== 4) throw new TrackerIdentError(`invalid IPv4: ${addr}`)
  const nums: number[] = []
  for (const p of parts) {
    const n = Number(p)
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      throw new TrackerIdentError(`invalid IPv4 octet "${p}" in: ${addr}`)
    }
    nums.push(n)
  }
  return nums.join('.')
}

function truncateIpv6To64(addr: string): string {
  const lower = addr.toLowerCase()
  if (!/^[0-9a-f:]+$/.test(lower)) {
    throw new TrackerIdentError(`invalid IPv6 chars: ${addr}`)
  }
  if ((lower.match(/::/g) || []).length > 1) {
    throw new TrackerIdentError(`invalid IPv6 (multiple "::"): ${addr}`)
  }

  let groups: string[]
  if (lower.includes('::')) {
    const [head, tail] = lower.split('::')
    const headParts = head ? head.split(':') : []
    const tailParts = tail ? tail.split(':') : []
    const fillCount = 8 - headParts.length - tailParts.length
    if (fillCount < 0) {
      throw new TrackerIdentError(`invalid IPv6 (too many groups): ${addr}`)
    }
    groups = [...headParts, ...new Array(fillCount).fill('0'), ...tailParts]
  } else {
    groups = lower.split(':')
  }

  if (groups.length !== 8) {
    throw new TrackerIdentError(`invalid IPv6 (group count ${groups.length}): ${addr}`)
  }
  for (const g of groups) {
    if (g.length === 0 || g.length > 4 || !/^[0-9a-f]+$/.test(g)) {
      throw new TrackerIdentError(`invalid IPv6 group "${g}" in: ${addr}`)
    }
  }

  // Keep first 4 groups (/64), zero the rest, render with trailing "::".
  // Strip leading zeros from each group so "2001:0db8" and "2001:db8" hash
  // identically.
  const canonical = groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16))
  return `${canonical.join(':')}::`
}

// ── HMAC helpers ──────────────────────────────────────────────────────

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  const bytes = new Uint8Array(sig)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

// ── Session id + ip hash ──────────────────────────────────────────────

export interface SessionDerivationInput {
  ipTruncated: string
  userAgent: string
  websiteId: string
  dayUtc: string
  secret: string
}

/** Stable per-day session id keyed on (ip, ua, website, dayUtc). */
export async function deriveSessionId(input: SessionDerivationInput): Promise<string> {
  if (!input.secret) throw new SecretMissingError('TRACKER_HASH_SECRET')
  if (!input.ipTruncated) throw new TrackerIdentError('ipTruncated required')
  if (!input.websiteId) throw new TrackerIdentError('websiteId required')
  if (!input.dayUtc) throw new TrackerIdentError('dayUtc required')
  // Cap UA length before hashing so a malicious 1MB UA can't burn CPU.
  const ua = (input.userAgent ?? '').slice(0, MAX_UA_LENGTH)
  const msg = ['s', input.ipTruncated, ua, input.websiteId, input.dayUtc].join('|')
  return hmacSha256Hex(input.secret, msg)
}

export interface IpHashInput {
  ipTruncated: string
  secret: string
}

/** Forensic fingerprint stable across days for one truncated IP. */
export async function deriveIpHash(input: IpHashInput): Promise<string> {
  if (!input.secret) throw new SecretMissingError('TRACKER_HASH_SECRET')
  if (!input.ipTruncated) throw new TrackerIdentError('ipTruncated required')
  return hmacSha256Hex(input.secret, ['ip', input.ipTruncated].join('|'))
}
