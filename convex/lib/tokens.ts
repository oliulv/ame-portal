import { randomToken } from './random'

export function generateToken(): string {
  return randomToken(43)
}

export function getExpiration(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}
