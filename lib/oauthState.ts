import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

function getSecret(): string {
  const s = process.env.OAUTH_STATE_SECRET
  if (!s || s.length < 32) {
    throw new Error('OAUTH_STATE_SECRET missing or shorter than 32 chars')
  }
  return s
}

/**
 * Sign an opaque payload for OAuth `state` round-trips.
 * Stateless: no DB write. TTL defaults to 10 min.
 */
export function signState(payload: Record<string, unknown>, ttlSec = 600): string {
  const body = {
    ...payload,
    n: randomBytes(16).toString('base64url'),
    e: Math.floor(Date.now() / 1000) + ttlSec,
  }
  const b64 = Buffer.from(JSON.stringify(body)).toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

/**
 * Verify a state string produced by signState. Returns the payload or null
 * on any failure (bad format, bad signature, expired).
 */
export function verifyState<T = Record<string, unknown>>(
  state: string | null | undefined
): T | null {
  if (!state) return null
  const dot = state.indexOf('.')
  if (dot <= 0 || dot === state.length - 1) return null
  const b64 = state.slice(0, dot)
  const givenSig = state.slice(dot + 1)
  const expectSig = createHmac('sha256', getSecret()).update(b64).digest('base64url')
  const a = Buffer.from(givenSig)
  const b = Buffer.from(expectSig)
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null
  let body: Record<string, unknown>
  try {
    body = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof body.e !== 'number' || body.e < Math.floor(Date.now() / 1000)) return null
  return body as T
}
