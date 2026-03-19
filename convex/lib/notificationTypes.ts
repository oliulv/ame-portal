export type NotificationAudience = 'admins' | 'founders' | 'all'
export type NotificationStatus = 'active' | 'planned'

export interface NotificationType {
  key: string
  label: string
  audience: NotificationAudience
  description: string
  status: NotificationStatus
}

/**
 * Single source of truth for all notification types in the platform.
 * Adding a new type here + wiring the scheduler call = fully functional.
 * Dashboard renders from this list dynamically.
 */
export const NOTIFICATION_TYPES: NotificationType[] = [
  // ── Currently Active ────────────────────────────────────────
  {
    key: 'invoiceSubmitted',
    label: 'Invoice Submitted',
    audience: 'admins',
    description: 'When a founder submits a new invoice',
    status: 'active',
  },
  {
    key: 'invoiceStatusChanged',
    label: 'Invoice Status Changed',
    audience: 'founders',
    description: 'When an invoice is approved or rejected',
    status: 'active',
  },
  {
    key: 'invoicePaid',
    label: 'Invoice Paid',
    audience: 'founders',
    description: 'When an invoice is marked as paid',
    status: 'active',
  },
  {
    key: 'milestoneSubmitted',
    label: 'Milestone Submitted',
    audience: 'admins',
    description: 'When a founder submits milestone evidence',
    status: 'active',
  },
  {
    key: 'milestoneStatusChanged',
    label: 'Milestone Status Changed',
    audience: 'founders',
    description: 'When a milestone is approved or needs changes',
    status: 'active',
  },
  {
    key: 'milestoneCreated',
    label: 'Milestone Created',
    audience: 'founders',
    description: 'When a new milestone is created for a startup',
    status: 'active',
  },
  {
    key: 'announcements',
    label: 'Announcements',
    audience: 'all',
    description: 'Important announcements from the programme',
    status: 'active',
  },
  {
    key: 'eventReminders',
    label: 'Event Reminders',
    audience: 'founders',
    description: 'Daily reminders for events happening today',
    status: 'active',
  },
  {
    key: 'eventCreated',
    label: 'Event Created',
    audience: 'founders',
    description: 'When a new cohort event is created',
    status: 'active',
  },
  {
    key: 'resourceSubmitted',
    label: 'Resource Submitted',
    audience: 'admins',
    description: 'When a founder submits a resource for review',
    status: 'active',
  },
  {
    key: 'resourceReviewed',
    label: 'Resource Reviewed',
    audience: 'founders',
    description: 'When a submitted resource is approved or rejected',
    status: 'active',
  },
  {
    key: 'onboardingCompleted',
    label: 'Onboarding Completed',
    audience: 'admins',
    description: 'When a founder completes full onboarding',
    status: 'active',
  },
  {
    key: 'invitationAccepted',
    label: 'Invitation Accepted',
    audience: 'admins',
    description: 'When a founder accepts an invite and joins',
    status: 'active',
  },
  {
    key: 'perkClaimed',
    label: 'Perk Claimed',
    audience: 'admins',
    description: 'When a founder claims a perk',
    status: 'active',
  },

  {
    key: 'milestoneWithdrawn',
    label: 'Milestone Withdrawn',
    audience: 'admins',
    description: 'When a founder withdraws a submitted milestone',
    status: 'active',
  },
  {
    key: 'milestoneDeleted',
    label: 'Milestone Deleted',
    audience: 'founders',
    description: 'When an admin deletes a milestone',
    status: 'active',
  },
  {
    key: 'eventUpdated',
    label: 'Event Updated',
    audience: 'founders',
    description: 'When an admin edits event details',
    status: 'active',
  },
  {
    key: 'eventCancelled',
    label: 'Event Cancelled',
    audience: 'founders',
    description: 'When an admin deactivates an event',
    status: 'active',
  },
  {
    key: 'bankDetailsAdded',
    label: 'Bank Details Added',
    audience: 'admins',
    description: 'When a founder adds bank details',
    status: 'active',
  },
  {
    key: 'perkCreated',
    label: 'Perk Created',
    audience: 'founders',
    description: 'When an admin creates a new perk',
    status: 'active',
  },
  {
    key: 'founderRemoved',
    label: 'Founder Removed',
    audience: 'founders',
    description: 'When an admin removes a founder from a startup',
    status: 'active',
  },
]

/** Only active notification types (wired up and functional) */
export const ACTIVE_NOTIFICATION_TYPES = NOTIFICATION_TYPES.filter((t) => t.status === 'active')

/** All notification type keys */
export const ALL_NOTIFICATION_KEYS = NOTIFICATION_TYPES.map((t) => t.key)

/** Active keys only */
export const ACTIVE_NOTIFICATION_KEYS = ACTIVE_NOTIFICATION_TYPES.map((t) => t.key)
