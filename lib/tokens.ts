import { randomBytes } from 'crypto'

/**
 * Generate a secure random token for invitations
 * @param length - Length of the token in bytes (default: 32)
 * @returns URL-safe base64 encoded token
 */
export function generateInvitationToken(length: number = 32): string {
  return randomBytes(length)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Calculate expiration date for invitation
 * @param days - Number of days until expiration (default: 14)
 * @returns ISO date string
 */
export function getInvitationExpiration(days: number = 14): string {
  const expirationDate = new Date()
  expirationDate.setDate(expirationDate.getDate() + days)
  return expirationDate.toISOString()
}
