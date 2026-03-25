/**
 * Shared date utilities for leaderboard scoring and weekly updates.
 */

/** Get the Monday ISO date string (YYYY-MM-DD) for a given date. */
export function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

/** Generate week boundaries for a rolling window (most recent first). */
export function getWeekBoundaries(
  weeksBack: number
): Array<{ start: Date; end: Date; weekOf: string }> {
  const now = new Date()
  const weeks: Array<{ start: Date; end: Date; weekOf: string }> = []
  for (let i = 0; i < weeksBack; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const monday = getMonday(d)
    const start = new Date(monday + 'T00:00:00.000Z')
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    weeks.push({ start, end, weekOf: monday })
  }
  return weeks
}
