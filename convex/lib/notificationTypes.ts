export type NotificationAudience = 'admins' | 'founders' | 'all'
export type NotificationStatus = 'active' | 'planned'
export type NotificationGroup =
  | 'invoices'
  | 'milestones'
  | 'events'
  | 'resources'
  | 'announcements'
  | 'funding'
  | 'team'
  | 'perks'
  | 'weeklyUpdates'

export interface NotificationType {
  key: string
  label: string
  audience: NotificationAudience
  description: string
  status: NotificationStatus
  group: NotificationGroup
}

export const GROUP_LABELS: Record<NotificationGroup, string> = {
  invoices: 'Invoices',
  milestones: 'Milestones',
  weeklyUpdates: 'Weekly Updates',
  events: 'Events',
  announcements: 'Announcements',
  funding: 'Funding',
  resources: 'Resources',
  team: 'Team & Onboarding',
  perks: 'Perks',
}

/** Display order for groups */
export const GROUP_ORDER: NotificationGroup[] = [
  'invoices',
  'milestones',
  'weeklyUpdates',
  'events',
  'announcements',
  'funding',
  'resources',
  'team',
  'perks',
]

/**
 * Single source of truth for all notification types in the platform.
 * Adding a new type here + wiring the scheduler call = fully functional.
 * Dashboard renders from this list dynamically.
 */
export const NOTIFICATION_TYPES: NotificationType[] = [
  // ── Invoices ────────────────────────────────────────────────
  {
    key: 'invoiceSubmitted',
    label: 'Invoice Submitted',
    audience: 'admins',
    description: 'When a founder submits a new invoice',
    status: 'active',
    group: 'invoices',
  },
  {
    key: 'invoiceStatusChanged',
    label: 'Invoice Status Changed',
    audience: 'founders',
    description: 'When an invoice is approved or rejected',
    status: 'active',
    group: 'invoices',
  },
  {
    key: 'invoicePaid',
    label: 'Invoice Paid',
    audience: 'founders',
    description: 'When an invoice is marked as paid',
    status: 'active',
    group: 'invoices',
  },

  // ── Milestones ──────────────────────────────────────────────
  {
    key: 'milestoneSubmitted',
    label: 'Milestone Submitted',
    audience: 'admins',
    description: 'When a founder submits milestone evidence',
    status: 'active',
    group: 'milestones',
  },
  {
    key: 'milestoneStatusChanged',
    label: 'Milestone Status Changed',
    audience: 'founders',
    description: 'When a milestone is approved or needs changes',
    status: 'active',
    group: 'milestones',
  },
  {
    key: 'milestoneCreated',
    label: 'Milestone Created',
    audience: 'founders',
    description: 'When a new milestone is created for a startup',
    status: 'active',
    group: 'milestones',
  },
  {
    key: 'milestoneWithdrawn',
    label: 'Milestone Withdrawn',
    audience: 'admins',
    description: 'When a founder withdraws a submitted milestone',
    status: 'active',
    group: 'milestones',
  },
  {
    key: 'milestoneDeleted',
    label: 'Milestone Deleted',
    audience: 'founders',
    description: 'When an admin deletes a milestone',
    status: 'active',
    group: 'milestones',
  },

  // ── Weekly Updates ──────────────────────────────────────────
  {
    key: 'weeklyUpdateSubmitted',
    label: 'Weekly Update Submitted',
    audience: 'admins',
    description: 'When a founder submits their weekly update',
    status: 'active',
    group: 'weeklyUpdates',
  },
  {
    key: 'weeklyUpdateFavorited',
    label: 'Weekly Update Favourited',
    audience: 'founders',
    description: 'When your weekly update is marked as a favourite',
    status: 'active',
    group: 'weeklyUpdates',
  },

  // ── Events ──────────────────────────────────────────────────
  {
    key: 'eventReminders',
    label: 'Event Reminders',
    audience: 'founders',
    description: 'Daily reminders for events happening today',
    status: 'active',
    group: 'events',
  },
  {
    key: 'eventCreated',
    label: 'Event Created',
    audience: 'founders',
    description: 'When a new cohort event is created',
    status: 'active',
    group: 'events',
  },
  {
    key: 'eventUpdated',
    label: 'Event Updated',
    audience: 'founders',
    description: 'When an admin edits event details',
    status: 'active',
    group: 'events',
  },
  {
    key: 'eventCancelled',
    label: 'Event Cancelled',
    audience: 'founders',
    description: 'When an admin deactivates an event',
    status: 'active',
    group: 'events',
  },

  // ── Announcements ───────────────────────────────────────────
  {
    key: 'announcements',
    label: 'Announcements',
    audience: 'all',
    description: 'Important announcements from the programme',
    status: 'active',
    group: 'announcements',
  },

  // ── Funding ──────────────────────────────────────────────────────
  {
    key: 'fundingAdjustments',
    label: 'Funding Adjustments',
    audience: 'founders',
    description: 'When your available funding changes after an adjustment',
    status: 'active',
    group: 'funding',
  },

  // ── Resources ───────────────────────────────────────────────
  {
    key: 'resourceSubmitted',
    label: 'Resource Submitted',
    audience: 'admins',
    description: 'When a founder submits a resource for review',
    status: 'active',
    group: 'resources',
  },
  {
    key: 'resourceReviewed',
    label: 'Resource Reviewed',
    audience: 'founders',
    description: 'When a submitted resource is approved or rejected',
    status: 'active',
    group: 'resources',
  },

  // ── Team & Onboarding ──────────────────────────────────────
  {
    key: 'onboardingCompleted',
    label: 'Onboarding Completed',
    audience: 'admins',
    description: 'When a founder completes full onboarding',
    status: 'active',
    group: 'team',
  },
  {
    key: 'invitationAccepted',
    label: 'Invitation Accepted',
    audience: 'admins',
    description: 'When a founder accepts an invite and joins',
    status: 'active',
    group: 'team',
  },
  {
    key: 'bankDetailsAdded',
    label: 'Bank Details Added',
    audience: 'admins',
    description: 'When a founder adds bank details',
    status: 'active',
    group: 'team',
  },
  {
    key: 'founderRemoved',
    label: 'Founder Removed',
    audience: 'founders',
    description: 'When an admin removes a founder from a startup',
    status: 'active',
    group: 'team',
  },

  // ── Perks ───────────────────────────────────────────────────
  {
    key: 'perkClaimed',
    label: 'Perk Claimed',
    audience: 'admins',
    description: 'When a founder claims a perk',
    status: 'active',
    group: 'perks',
  },
  {
    key: 'perkCreated',
    label: 'Perk Created',
    audience: 'founders',
    description: 'When an admin creates a new perk',
    status: 'active',
    group: 'perks',
  },
]

/** Only active notification types (wired up and functional) */
export const ACTIVE_NOTIFICATION_TYPES = NOTIFICATION_TYPES.filter((t) => t.status === 'active')

/** All notification type keys */
export const ALL_NOTIFICATION_KEYS = NOTIFICATION_TYPES.map((t) => t.key)

/** Active keys only */
export const ACTIVE_NOTIFICATION_KEYS = ACTIVE_NOTIFICATION_TYPES.map((t) => t.key)

/** Group notification types by their group field, in display order */
export function groupByCategory(types: NotificationType[]) {
  const grouped: { group: NotificationGroup; label: string; types: NotificationType[] }[] = []
  for (const g of GROUP_ORDER) {
    const items = types.filter((t) => t.group === g)
    if (items.length > 0) {
      grouped.push({ group: g, label: GROUP_LABELS[g], types: items })
    }
  }
  return grouped
}
