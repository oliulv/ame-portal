export type AcceptDecision =
  | { ok: true }
  | { ok: false; reason: 'wrong_email' | 'expired' | 'already_accepted' }

/**
 * Pure decision for an invitation-accept call. Email comparison is
 * case-insensitive. The caller is expected to have pulled `clerkEmail`
 * from `ctx.auth.getUserIdentity()`.
 */
export function evaluateInviteAccept(
  invitation: { email: string; expiresAt: string; acceptedAt?: string },
  clerkEmail: string | undefined | null,
  now: Date
): AcceptDecision {
  if (!clerkEmail || clerkEmail.toLowerCase() !== invitation.email.toLowerCase()) {
    return { ok: false, reason: 'wrong_email' }
  }
  if (invitation.acceptedAt) return { ok: false, reason: 'already_accepted' }
  if (new Date(invitation.expiresAt) < now) return { ok: false, reason: 'expired' }
  return { ok: true }
}
