// CSPRNG helpers for the Convex isolate runtime.
// Mutations/queries only expose WebCrypto — never import "node:crypto" here
// (that only works in actions with "use node").

const URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n)
  crypto.getRandomValues(buf)
  return buf
}

/** URL-safe token of `len` chars using a 64-symbol alphabet. */
export function randomToken(len = 43): string {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += URL_ALPHABET[bytes[i] & 0x3f]
  return out
}

/** Uniform integer in [0, max) using rejection sampling (no modulo bias). */
export function randomIntBelow(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) {
    throw new Error('randomIntBelow: max must be a positive integer <= 2^32')
  }
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buf = new Uint32Array(1)

  while (true) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % max
  }
}

/** Zero-padded numeric code of fixed digit length (e.g. 6-digit OTP). */
export function randomNumericCode(digits: number): string {
  if (!Number.isInteger(digits) || digits < 1 || digits > 9) {
    throw new Error('randomNumericCode: digits must be 1..9')
  }
  const n = randomIntBelow(10 ** digits)
  return n.toString().padStart(digits, '0')
}

/** Constant-time string equality (equal length inputs expected). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Hex-encoded SHA-256 of a UTF-8 string. Uses WebCrypto (available in Convex isolate). */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  const bytes = new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}
