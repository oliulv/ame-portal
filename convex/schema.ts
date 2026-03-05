import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // ── Users ──────────────────────────────────────────────────────────
  users: defineTable({
    clerkId: v.string(),
    role: v.union(v.literal('super_admin'), v.literal('admin'), v.literal('founder')),
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index('by_clerkId', ['clerkId']),

  // ── Cohorts ────────────────────────────────────────────────────────
  cohorts: defineTable({
    name: v.string(),
    slug: v.string(),
    yearStart: v.number(),
    yearEnd: v.number(),
    label: v.string(),
    isActive: v.boolean(),
    fundingBudget: v.optional(v.number()),
    baseFunding: v.optional(v.number()),
  }).index('by_slug', ['slug']),

  // ── Admin ↔ Cohort assignments ────────────────────────────────────
  adminCohorts: defineTable({
    userId: v.id('users'),
    cohortId: v.id('cohorts'),
  })
    .index('by_userId', ['userId'])
    .index('by_cohortId', ['cohortId'])
    .index('by_userId_cohortId', ['userId', 'cohortId']),

  // ── Startups ───────────────────────────────────────────────────────
  startups: defineTable({
    cohortId: v.id('cohorts'),
    name: v.string(),
    slug: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    stage: v.optional(v.string()),
    sector: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    onboardingStatus: v.union(
      v.literal('pending'),
      v.literal('in_progress'),
      v.literal('completed')
    ),
    fundingDeployed: v.optional(v.number()),
    excludeFromMetrics: v.optional(v.boolean()),
  })
    .index('by_cohortId', ['cohortId'])
    .index('by_slug', ['slug']),

  // ── Startup Profiles ───────────────────────────────────────────────
  startupProfiles: defineTable({
    startupId: v.id('startups'),
    oneLiner: v.optional(v.string()),
    description: v.optional(v.string()),
    companyUrl: v.optional(v.string()),
    productUrl: v.optional(v.string()),
    industry: v.optional(v.string()),
    location: v.optional(v.string()),
    initialCustomers: v.optional(v.number()),
    initialRevenue: v.optional(v.number()),
  }).index('by_startupId', ['startupId']),

  // ── Founder Profiles ───────────────────────────────────────────────
  founderProfiles: defineTable({
    userId: v.id('users'),
    startupId: v.id('startups'),
    fullName: v.string(),
    personalEmail: v.string(),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    postcode: v.optional(v.string()),
    country: v.optional(v.string()),
    phone: v.optional(v.string()),
    bio: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    xUrl: v.optional(v.string()),
    onboardingStatus: v.union(
      v.literal('pending'),
      v.literal('in_progress'),
      v.literal('completed')
    ),
  })
    .index('by_userId', ['userId'])
    .index('by_startupId', ['startupId']),

  // ── Bank Details ───────────────────────────────────────────────────
  bankDetails: defineTable({
    startupId: v.id('startups'),
    accountHolderName: v.string(),
    sortCode: v.string(),
    accountNumber: v.string(),
    bankName: v.optional(v.string()),
    verified: v.boolean(),
  }).index('by_startupId', ['startupId']),

  // ── Milestone Templates ────────────────────────────────────────────
  milestoneTemplates: defineTable({
    cohortId: v.id('cohorts'),
    title: v.string(),
    description: v.string(),
    amount: v.number(),
    dueDate: v.optional(v.string()),
    sortOrder: v.number(),
    isActive: v.boolean(),
    requireLink: v.optional(v.boolean()),
    requireFile: v.optional(v.boolean()),
  }).index('by_cohortId', ['cohortId']),

  // ── Milestones ────────────────────────────────────────────────────
  milestones: defineTable({
    startupId: v.id('startups'),
    milestoneTemplateId: v.optional(v.id('milestoneTemplates')),
    title: v.string(),
    description: v.string(),
    amount: v.number(),
    status: v.union(v.literal('waiting'), v.literal('submitted'), v.literal('approved')),
    dueDate: v.optional(v.string()),
    sortOrder: v.number(),
    planLink: v.optional(v.string()),
    planStorageId: v.optional(v.id('_storage')),
    planFileName: v.optional(v.string()),
    requireLink: v.optional(v.boolean()),
    requireFile: v.optional(v.boolean()),
  })
    .index('by_startupId', ['startupId'])
    .index('by_milestoneTemplateId', ['milestoneTemplateId']),

  // ── Invitations (founder) ──────────────────────────────────────────
  invitations: defineTable({
    startupId: v.id('startups'),
    email: v.string(),
    fullName: v.string(),
    token: v.string(),
    role: v.literal('founder'),
    expiresAt: v.string(),
    acceptedAt: v.optional(v.string()),
    createdByAdminId: v.optional(v.id('users')),
    createdByUserId: v.optional(v.id('users')),
  })
    .index('by_token', ['token'])
    .index('by_startupId', ['startupId'])
    .index('by_email', ['email']),

  // ── Admin Invitations ──────────────────────────────────────────────
  adminInvitations: defineTable({
    email: v.string(),
    token: v.string(),
    role: v.union(v.literal('admin'), v.literal('super_admin')),
    invitedName: v.optional(v.string()),
    expiresAt: v.string(),
    acceptedAt: v.optional(v.string()),
    createdByUserId: v.id('users'),
    cohortId: v.optional(v.id('cohorts')),
  })
    .index('by_token', ['token'])
    .index('by_email', ['email']),

  // ── Invoices ───────────────────────────────────────────────────────
  invoices: defineTable({
    startupId: v.id('startups'),
    uploadedByUserId: v.id('users'),
    vendorName: v.string(),
    invoiceDate: v.string(),
    dueDate: v.optional(v.string()),
    amountGbp: v.number(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    storageId: v.id('_storage'),
    fileName: v.string(),
    receiptStorageId: v.optional(v.id('_storage')),
    receiptFileName: v.optional(v.string()),
    status: v.union(
      v.literal('submitted'),
      v.literal('under_review'),
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('paid')
    ),
    approvedByAdminId: v.optional(v.id('users')),
    approvedAt: v.optional(v.string()),
    paidAt: v.optional(v.string()),
    adminComment: v.optional(v.string()),
  })
    .index('by_startupId', ['startupId'])
    .index('by_status', ['status']),

  // ── Integration Connections ────────────────────────────────────────
  integrationConnections: defineTable({
    startupId: v.id('startups'),
    provider: v.union(v.literal('stripe'), v.literal('tracker')),
    accountId: v.optional(v.string()),
    accountName: v.optional(v.string()),
    status: v.union(v.literal('active'), v.literal('error'), v.literal('disconnected')),
    scopes: v.optional(v.array(v.string())),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.string()),
    connectedByUserId: v.optional(v.id('users')),
    connectedAt: v.optional(v.string()),
    lastSyncedAt: v.optional(v.string()),
    syncError: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index('by_startupId', ['startupId'])
    .index('by_startupId_provider', ['startupId', 'provider']),

  // ── Metrics Data ───────────────────────────────────────────────────
  metricsData: defineTable({
    startupId: v.id('startups'),
    provider: v.union(v.literal('stripe'), v.literal('tracker'), v.literal('manual')),
    metricKey: v.string(),
    value: v.number(),
    timestamp: v.string(),
    window: v.union(v.literal('daily'), v.literal('weekly'), v.literal('monthly')),
    meta: v.optional(v.any()),
  })
    .index('by_startupId', ['startupId'])
    .index('by_startupId_provider_metricKey', ['startupId', 'provider', 'metricKey'])
    .index('by_startupId_metricKey_timestamp', ['startupId', 'metricKey', 'timestamp']),

  // ── Tracker Websites ───────────────────────────────────────────────
  trackerWebsites: defineTable({
    startupId: v.id('startups'),
    name: v.string(),
    domain: v.optional(v.string()),
    lastEventAt: v.optional(v.string()),
  }).index('by_startupId', ['startupId']),

  // ── Tracker Events ─────────────────────────────────────────────────
  trackerEvents: defineTable({
    websiteId: v.id('trackerWebsites'),
    sessionId: v.optional(v.string()),
    eventName: v.optional(v.string()),
    url: v.string(),
    referrer: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    utmTerm: v.optional(v.string()),
    utmContent: v.optional(v.string()),
    country: v.optional(v.string()),
    device: v.optional(v.string()),
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
    screen: v.optional(v.string()),
    language: v.optional(v.string()),
    title: v.optional(v.string()),
    hostname: v.optional(v.string()),
    data: v.optional(v.any()),
  })
    .index('by_websiteId', ['websiteId'])
    .index('by_websiteId_eventName', ['websiteId', 'eventName']),

  // ── Cohort Events ─────────────────────────────────────────────
  cohortEvents: defineTable({
    cohortId: v.id('cohorts'),
    title: v.string(),
    description: v.optional(v.string()),
    date: v.string(),
    lumaEmbedUrl: v.string(),
    sortOrder: v.number(),
    isActive: v.boolean(),
  }).index('by_cohortId', ['cohortId']),

  // ── Perks (global, not per-cohort) ──────────────────────────────
  perks: defineTable({
    cohortId: v.optional(v.id('cohorts')), // Legacy field, not used
    title: v.string(),
    description: v.string(),
    details: v.optional(v.string()),
    category: v.optional(v.string()),
    providerName: v.optional(v.string()),
    providerLogoUrl: v.optional(v.string()),
    url: v.optional(v.string()),
    isActive: v.boolean(),
    isPartnership: v.optional(v.boolean()),
    sortOrder: v.number(),
  }),

  // ── Event Registrations ────────────────────────────────────────
  eventRegistrations: defineTable({
    eventId: v.id('cohortEvents'),
    userId: v.id('users'),
    registeredAt: v.string(),
  })
    .index('by_eventId', ['eventId'])
    .index('by_userId', ['userId'])
    .index('by_eventId_userId', ['eventId', 'userId']),

  // ── Perk Claims ────────────────────────────────────────────────
  perkClaims: defineTable({
    perkId: v.id('perks'),
    userId: v.id('users'),
    startupId: v.id('startups'),
    claimedAt: v.string(),
  })
    .index('by_perkId', ['perkId'])
    .index('by_userId', ['userId'])
    .index('by_perkId_userId', ['perkId', 'userId'])
    .index('by_startupId', ['startupId']),
})
