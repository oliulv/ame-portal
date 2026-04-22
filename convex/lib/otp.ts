export interface OtpState {
  otpCodeHash?: string
  otpExpiresAt?: string
  otpAttempts?: number
}

export type OtpCheck =
  | { ok: true }
  | { ok: false; reason: 'none' | 'expired' | 'locked' | 'wrong'; attempts: number }

export const OTP_MAX_ATTEMPTS = 5

/**
 * Pure decision for an OTP submission. Compare already-hashed candidate
 * against the stored hash so the caller can use a constant-time compare.
 */
export function evaluateOtp(
  state: OtpState,
  candidateHash: string,
  now: Date,
  max: number = OTP_MAX_ATTEMPTS
): OtpCheck {
  if (!state.otpCodeHash || !state.otpExpiresAt) {
    return { ok: false, reason: 'none', attempts: state.otpAttempts ?? 0 }
  }
  if (new Date(state.otpExpiresAt) < now) {
    return { ok: false, reason: 'expired', attempts: state.otpAttempts ?? 0 }
  }
  if ((state.otpAttempts ?? 0) >= max) {
    return { ok: false, reason: 'locked', attempts: state.otpAttempts ?? 0 }
  }
  const match = state.otpCodeHash === candidateHash
  return match
    ? { ok: true }
    : { ok: false, reason: 'wrong', attempts: (state.otpAttempts ?? 0) + 1 }
}
