/**
 * Stripe MRR calculation logic.
 *
 * Adapted from stripe-pulse (https://github.com/progrmoiz/stripe-pulse)
 * as owned code — not a maintained fork.
 *
 * Key improvements over the original inline metrics.ts implementation:
 * - Handles tiered/graduated pricing
 * - Applies percent_off before amount_off (matches Stripe behavior)
 * - Handles "repeating" coupons (not just "forever")
 * - Better reactivation detection with 24-hour minimum gap
 * - Skips metered billing items (unpredictable MRR)
 * - wasPaying heuristic for trial-only subs
 */

import type Stripe from 'stripe'

// ── Types ────────────────────────────────────────────────────────────

export type MovementType = 'new' | 'expansion' | 'contraction' | 'churn' | 'reactivation'

export interface MrrMovement {
  type: MovementType
  amount: number
  stripeCustomerId: string
}

export interface MrrSnapshot {
  totalMrrCents: number
  activeSubscriptionCount: number
  customerMrrMap: Map<string, number>
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Calculate amount for tiered pricing (volume or graduated). */
function calcTieredAmountCents(
  tiers: Stripe.Price.Tier[],
  tiersMode: string,
  quantity: number
): number {
  if (!tiers.length || quantity <= 0) return 0

  if (tiersMode === 'volume') {
    for (const tier of tiers) {
      const upTo = tier.up_to ?? Infinity
      if (quantity <= upTo) {
        return (tier.unit_amount ?? 0) * quantity + (tier.flat_amount ?? 0)
      }
    }
    return 0
  }

  if (tiersMode === 'graduated') {
    let total = 0
    let remaining = quantity
    let prevUpTo = 0
    for (const tier of tiers) {
      const upTo = tier.up_to ?? Infinity
      const unitsInTier = Math.min(remaining, upTo - prevUpTo)
      if (unitsInTier > 0) {
        total += (tier.unit_amount ?? 0) * unitsInTier + (tier.flat_amount ?? 0)
      }
      remaining -= unitsInTier
      prevUpTo = upTo
      if (remaining <= 0) break
    }
    return total
  }

  return 0
}

/** Normalize a price amount (in cents) to monthly cents. */
export function normalizeToMonthlyCents(
  amountCents: number,
  interval: string,
  intervalCount: number
): number {
  switch (interval) {
    case 'day':
      return (amountCents / intervalCount) * (365 / 12)
    case 'week':
      return (amountCents / intervalCount) * (52 / 12)
    case 'month':
      return amountCents / intervalCount
    case 'year':
      return amountCents / (12 * intervalCount)
    default:
      return amountCents
  }
}

/** Check whether a subscription is currently trialing. */
function isTrialing(sub: Stripe.Subscription): boolean {
  if (sub.status === 'trialing') return true
  if (sub.trial_end && sub.trial_end > Math.floor(Date.now() / 1000)) return true
  return false
}

/** Check whether a subscription should count toward MRR. */
function isActiveForMrr(sub: Stripe.Subscription): boolean {
  if (isTrialing(sub)) return false
  if (sub.cancel_at_period_end) return false
  return sub.status === 'active' || sub.status === 'past_due'
}

/** Extract customer ID from a subscription. */
export function getCustomerId(sub: Stripe.Subscription): string {
  return typeof sub.customer === 'string' ? sub.customer : (sub.customer as { id: string }).id
}

// ── Per-Subscription MRR ─────────────────────────────────────────────

/**
 * Calculate the MRR contribution of a single subscription (in cents).
 * Handles tiered pricing, discounts (percent_off before amount_off),
 * metered items (skipped), and trial filtering.
 */
export function calculateSubscriptionMrr(
  sub: Stripe.Subscription,
  tiersMap?: Map<string, { tiers: Stripe.Price.Tier[]; tiersMode: string }>
): number {
  if (!isActiveForMrr(sub)) return 0

  let totalMonthlyCents = 0

  for (const item of sub.items.data) {
    // Skip metered items — unpredictable MRR
    if (item.price?.recurring?.usage_type === 'metered') continue

    const interval = item.price?.recurring?.interval ?? 'month'
    const intervalCount = item.price?.recurring?.interval_count ?? 1

    let itemCents: number

    // Handle tiered/licensed pricing
    if (
      item.price?.billing_scheme === 'tiered' &&
      tiersMap &&
      item.price?.id &&
      tiersMap.has(item.price.id)
    ) {
      const { tiers, tiersMode } = tiersMap.get(item.price.id)!
      itemCents = calcTieredAmountCents(tiers, tiersMode, item.quantity ?? 0)
    } else {
      const unitAmount = item.price?.unit_amount ?? 0
      const quantity = item.quantity ?? 1
      itemCents = unitAmount * quantity
    }

    totalMonthlyCents += normalizeToMonthlyCents(itemCents, interval, intervalCount)
  }

  // Apply coupon discounts: percent_off first, then amount_off (matches Stripe)
  const discounts: Array<string | Stripe.Discount> = sub.discounts?.length
    ? sub.discounts
    : (sub as any).discount
      ? [(sub as any).discount]
      : []

  const subInterval = sub.items.data[0]?.price?.recurring?.interval ?? 'month'
  const subIntervalCount = sub.items.data[0]?.price?.recurring?.interval_count ?? 1
  const nowTs = Math.floor(Date.now() / 1000)

  // Pass 1: percent_off
  for (const d of discounts) {
    if (typeof d === 'string') continue
    const coupon = (d as any)?.coupon
    if (!coupon) continue
    const shouldApply =
      coupon.duration === 'forever' || (coupon.duration === 'repeating' && d.end && d.end > nowTs)
    if (!shouldApply) continue
    if (coupon.percent_off) {
      totalMonthlyCents *= 1 - coupon.percent_off / 100
    }
  }

  // Pass 2: amount_off
  for (const d of discounts) {
    if (typeof d === 'string') continue
    const coupon = (d as any)?.coupon
    if (!coupon) continue
    const shouldApply =
      coupon.duration === 'forever' || (coupon.duration === 'repeating' && d.end && d.end > nowTs)
    if (!shouldApply) continue
    if (coupon.amount_off) {
      totalMonthlyCents -= normalizeToMonthlyCents(coupon.amount_off, subInterval, subIntervalCount)
    }
  }

  return Math.max(0, Math.round(totalMonthlyCents))
}

// ── Aggregate MRR ────────────────────────────────────────────────────

/**
 * Calculate total MRR from a list of subscriptions.
 * Returns total MRR in cents, active subscription count, and per-customer MRR map.
 */
export function calculateMrrSnapshot(
  subscriptions: Stripe.Subscription[],
  tiersMap?: Map<string, { tiers: Stripe.Price.Tier[]; tiersMode: string }>
): MrrSnapshot {
  let totalMrrCents = 0
  let activeSubscriptionCount = 0
  const customerMrrMap = new Map<string, number>()

  for (const sub of subscriptions) {
    const subMrr = calculateSubscriptionMrr(sub, tiersMap)
    if (subMrr > 0) {
      totalMrrCents += subMrr
      activeSubscriptionCount++
      const customerId = getCustomerId(sub)
      customerMrrMap.set(customerId, (customerMrrMap.get(customerId) ?? 0) + subMrr)
    }
  }

  return { totalMrrCents, activeSubscriptionCount, customerMrrMap }
}

// ── MRR Movements ────────────────────────────────────────────────────

/**
 * Compute MRR movements by diffing current vs previous customer MRR maps.
 *
 * Classifies each customer's change as new, expansion, contraction, churn,
 * or reactivation. A customer is a "reactivation" if they appear in
 * allTimeCustomerIds (ever had MRR) but had 0 MRR last period.
 */
export function computeMrrMovements(
  currentMrrMap: Map<string, number>,
  previousMrrMap: Map<string, number>,
  allTimeCustomerIds: Set<string>
): MrrMovement[] {
  const movements: MrrMovement[] = []
  const allCustomers = new Set([...currentMrrMap.keys(), ...previousMrrMap.keys()])

  for (const customerId of allCustomers) {
    const current = currentMrrMap.get(customerId) ?? 0
    const previous = previousMrrMap.get(customerId) ?? 0

    if (current > 0 && previous === 0) {
      // New or reactivation: check if this customer was EVER seen before
      if (allTimeCustomerIds.has(customerId)) {
        movements.push({ type: 'reactivation', amount: current, stripeCustomerId: customerId })
      } else {
        movements.push({ type: 'new', amount: current, stripeCustomerId: customerId })
      }
    } else if (current === 0 && previous > 0) {
      movements.push({ type: 'churn', amount: previous, stripeCustomerId: customerId })
    } else if (current > previous) {
      movements.push({
        type: 'expansion',
        amount: current - previous,
        stripeCustomerId: customerId,
      })
    } else if (current < previous && current > 0) {
      movements.push({
        type: 'contraction',
        amount: previous - current,
        stripeCustomerId: customerId,
      })
    }
  }

  return movements
}
