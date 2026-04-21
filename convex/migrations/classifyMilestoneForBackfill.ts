/**
 * Pure classifier for backfillMilestoneApprovedAt. Given a milestone row and
 * its milestoneEvents, decide what to do: patch with a derived approvedAt,
 * or skip with a reason. Kept side-effect-free so the invariant
 * `patched + skipped_* === total` is unit-testable without Convex.
 */

export type BackfillClassification =
  | { kind: 'patch'; approvedAt: string }
  | { kind: 'skip-not-approved' }
  | { kind: 'skip-already-set' }
  | { kind: 'skip-no-event' }

export function classifyMilestoneForBackfill(
  milestone: { status: string; approvedAt?: string },
  events: Array<{ action: string; _creationTime: number }>
): BackfillClassification {
  if (milestone.status !== 'approved') return { kind: 'skip-not-approved' }
  if (milestone.approvedAt) return { kind: 'skip-already-set' }
  const latestApproval = events
    .filter((e) => e.action === 'approved')
    .sort((a, b) => b._creationTime - a._creationTime)[0]
  if (!latestApproval) return { kind: 'skip-no-event' }
  return {
    kind: 'patch',
    approvedAt: new Date(latestApproval._creationTime).toISOString(),
  }
}
