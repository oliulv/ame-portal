/**
 * Live weekly-update streak computation.
 *
 * A streak is the number of consecutive weeks (ending with the current or most
 * recently deadlined week) that a startup submitted a weekly update. Computed
 * on-read from the `weeklyUpdates` array — no cached column, no cron.
 */

import { getMonday } from './dateUtils'

interface WeeklyUpdateLike {
  weekOf: string // 'YYYY-MM-DD' Monday
}

/**
 * The deadline for a given week's update is Monday 9am UTC of the FOLLOWING
 * week. Mirrors `convex/weeklyUpdates.ts:submit`. Matching this keeps streak
 * calculation consistent with submit-side rules.
 */
function weekDeadline(weekOf: string): Date {
  const deadline = new Date(weekOf + 'T00:00:00.000Z')
  deadline.setUTCDate(deadline.getUTCDate() + 7)
  deadline.setUTCHours(9, 0, 0, 0)
  return deadline
}

/** Add or subtract whole weeks from a YYYY-MM-DD Monday string. */
function shiftWeek(weekOf: string, weeks: number): string {
  const d = new Date(weekOf + 'T00:00:00.000Z')
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

/**
 * Compute the current update streak for a startup.
 *
 * The anchor is the most recent week that either has a submission OR is still
 * before its deadline (submissions can land on the current week mid-week). We
 * walk backward week-by-week and count consecutive submitted weeks until we
 * hit a gap.
 *
 * Mid-week rule: if the current week has not yet been submitted AND the
 * deadline for LAST week has not yet passed, the streak counts from last week
 * without penalising the user for not having submitted this week's update yet.
 * Once last week's deadline passes without a submission, the streak breaks.
 */
// A valid weekOf is a YYYY-MM-DD string (ISO date, no time component).
// We don't verify it's actually a Monday — `getMonday` upstream produces
// those — but we reject obviously malformed values so corrupted rows
// can't silently inflate or break a streak.
const WEEK_OF_FORMAT = /^\d{4}-\d{2}-\d{2}$/

export function computeStreak(updates: WeeklyUpdateLike[], now: Date): number {
  if (updates.length === 0) return 0

  const submittedWeeks = new Set<string>()
  for (const u of updates) {
    if (u.weekOf && WEEK_OF_FORMAT.test(u.weekOf)) submittedWeeks.add(u.weekOf)
  }
  if (submittedWeeks.size === 0) return 0

  const currentWeek = getMonday(now)
  const lastWeek = shiftWeek(currentWeek, -1)

  // Pick the anchor: the most recent week we count as "locked in".
  let anchor: string
  if (submittedWeeks.has(currentWeek)) {
    anchor = currentWeek
  } else if (submittedWeeks.has(lastWeek)) {
    anchor = lastWeek
  } else if (now < weekDeadline(lastWeek)) {
    // Grace period — last week's deadline hasn't passed, so we don't yet count
    // its absence as breaking the streak. Look further back.
    anchor = shiftWeek(lastWeek, -1)
  } else {
    // Last week's deadline passed with no submission → streak broken.
    return 0
  }

  let streak = 0
  let cursor = anchor
  while (submittedWeeks.has(cursor)) {
    streak++
    cursor = shiftWeek(cursor, -1)
  }
  return streak
}
