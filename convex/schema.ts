import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Users ──────────────────────────────────────────────────────────
  users: defineTable({
    clerkId: v.string(),
    role: v.union(
      v.literal("super_admin"),
      v.literal("admin"),
      v.literal("founder")
    ),
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
  }).index("by_clerkId", ["clerkId"]),

  // ── Cohorts ────────────────────────────────────────────────────────
  cohorts: defineTable({
    name: v.string(),
    slug: v.string(),
    yearStart: v.number(),
    yearEnd: v.number(),
    label: v.string(),
    isActive: v.boolean(),
  }).index("by_slug", ["slug"]),

  // ── Admin ↔ Cohort assignments ────────────────────────────────────
  adminCohorts: defineTable({
    userId: v.id("users"),
    cohortId: v.id("cohorts"),
  })
    .index("by_userId", ["userId"])
    .index("by_cohortId", ["cohortId"])
    .index("by_userId_cohortId", ["userId", "cohortId"]),

  // ── Startups ───────────────────────────────────────────────────────
  startups: defineTable({
    cohortId: v.id("cohorts"),
    name: v.string(),
    slug: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    stage: v.optional(v.string()),
    sector: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    onboardingStatus: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
  })
    .index("by_cohortId", ["cohortId"])
    .index("by_slug", ["slug"]),

  // ── Startup Profiles ───────────────────────────────────────────────
  startupProfiles: defineTable({
    startupId: v.id("startups"),
    oneLiner: v.optional(v.string()),
    description: v.optional(v.string()),
    companyUrl: v.optional(v.string()),
    productUrl: v.optional(v.string()),
    industry: v.optional(v.string()),
    location: v.optional(v.string()),
    initialCustomers: v.optional(v.number()),
    initialRevenue: v.optional(v.number()),
  }).index("by_startupId", ["startupId"]),

  // ── Founder Profiles ───────────────────────────────────────────────
  founderProfiles: defineTable({
    userId: v.id("users"),
    startupId: v.id("startups"),
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
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_startupId", ["startupId"]),

  // ── Bank Details ───────────────────────────────────────────────────
  bankDetails: defineTable({
    startupId: v.id("startups"),
    accountHolderName: v.string(),
    sortCode: v.string(),
    accountNumber: v.string(),
    bankName: v.optional(v.string()),
    verified: v.boolean(),
  }).index("by_startupId", ["startupId"]),

  // ── Goal Templates ─────────────────────────────────────────────────
  goalTemplates: defineTable({
    cohortId: v.id("cohorts"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    defaultTargetValue: v.optional(v.number()),
    defaultDeadline: v.optional(v.string()),
    defaultWeight: v.number(),
    defaultFundingAmount: v.optional(v.number()),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
  }).index("by_cohortId", ["cohortId"]),

  // ── Startup Goals ──────────────────────────────────────────────────
  startupGoals: defineTable({
    startupId: v.id("startups"),
    goalTemplateId: v.optional(v.id("goalTemplates")),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    targetValue: v.optional(v.number()),
    deadline: v.optional(v.string()),
    weight: v.number(),
    fundingAmount: v.optional(v.number()),
    status: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("waived")
    ),
    progressValue: v.number(),
    manuallyOverridden: v.boolean(),
    // Metric-based tracking
    dataSource: v.optional(
      v.union(v.literal("stripe"), v.literal("tracker"))
    ),
    metricKey: v.optional(v.string()),
    aggregationWindow: v.optional(
      v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"))
    ),
    targetValueMetric: v.optional(v.number()),
    comparisonOperator: v.optional(
      v.union(
        v.literal(">="),
        v.literal(">"),
        v.literal("="),
        v.literal("<="),
        v.literal("<"),
        v.literal("increased_by"),
        v.literal("decreased_by")
      )
    ),
    direction: v.optional(v.union(v.literal("up"), v.literal("down"))),
    lastMetricCheckAt: v.optional(v.string()),
    autoCompletedAt: v.optional(v.string()),
    completionSource: v.optional(
      v.union(v.literal("auto"), v.literal("manual"))
    ),
  })
    .index("by_startupId", ["startupId"])
    .index("by_goalTemplateId", ["goalTemplateId"]),

  // ── Goal Updates (audit trail) ─────────────────────────────────────
  goalUpdates: defineTable({
    startupGoalId: v.id("startupGoals"),
    userId: v.id("users"),
    previousStatus: v.optional(
      v.union(
        v.literal("not_started"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("waived")
      )
    ),
    newStatus: v.optional(
      v.union(
        v.literal("not_started"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("waived")
      )
    ),
    previousProgress: v.optional(v.number()),
    newProgress: v.optional(v.number()),
    comment: v.optional(v.string()),
  }).index("by_startupGoalId", ["startupGoalId"]),

  // ── Invitations (founder) ──────────────────────────────────────────
  invitations: defineTable({
    startupId: v.id("startups"),
    email: v.string(),
    fullName: v.string(),
    token: v.string(),
    role: v.literal("founder"),
    expiresAt: v.string(),
    acceptedAt: v.optional(v.string()),
    createdByAdminId: v.id("users"),
  })
    .index("by_token", ["token"])
    .index("by_startupId", ["startupId"])
    .index("by_email", ["email"]),

  // ── Admin Invitations ──────────────────────────────────────────────
  adminInvitations: defineTable({
    email: v.string(),
    token: v.string(),
    role: v.literal("admin"),
    invitedName: v.optional(v.string()),
    expiresAt: v.string(),
    acceptedAt: v.optional(v.string()),
    createdByUserId: v.id("users"),
    cohortId: v.optional(v.id("cohorts")),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"]),

  // ── Invoices ───────────────────────────────────────────────────────
  invoices: defineTable({
    startupId: v.id("startups"),
    uploadedByUserId: v.id("users"),
    vendorName: v.string(),
    invoiceDate: v.string(),
    dueDate: v.optional(v.string()),
    amountGbp: v.number(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    storageId: v.id("_storage"),
    fileName: v.string(),
    status: v.union(
      v.literal("submitted"),
      v.literal("under_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("paid")
    ),
    approvedByAdminId: v.optional(v.id("users")),
    approvedAt: v.optional(v.string()),
    paidAt: v.optional(v.string()),
    adminComment: v.optional(v.string()),
  })
    .index("by_startupId", ["startupId"])
    .index("by_status", ["status"]),

  // ── Integration Connections ────────────────────────────────────────
  integrationConnections: defineTable({
    startupId: v.id("startups"),
    provider: v.union(v.literal("stripe"), v.literal("tracker")),
    accountId: v.optional(v.string()),
    accountName: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("error"),
      v.literal("disconnected")
    ),
    scopes: v.optional(v.array(v.string())),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.string()),
    connectedByUserId: v.optional(v.id("users")),
    connectedAt: v.optional(v.string()),
    lastSyncedAt: v.optional(v.string()),
    syncError: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_startupId", ["startupId"])
    .index("by_startupId_provider", ["startupId", "provider"]),

  // ── Metrics Data ───────────────────────────────────────────────────
  metricsData: defineTable({
    startupId: v.id("startups"),
    provider: v.union(
      v.literal("stripe"),
      v.literal("tracker"),
      v.literal("manual")
    ),
    metricKey: v.string(),
    value: v.number(),
    timestamp: v.string(),
    window: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly")
    ),
    meta: v.optional(v.any()),
  })
    .index("by_startupId", ["startupId"])
    .index("by_startupId_provider_metricKey", [
      "startupId",
      "provider",
      "metricKey",
    ])
    .index("by_startupId_metricKey_timestamp", [
      "startupId",
      "metricKey",
      "timestamp",
    ]),

  // ── Startup Metric Manual ──────────────────────────────────────────
  startupMetricsManual: defineTable({
    startupId: v.id("startups"),
    metricName: v.string(),
    metricValue: v.number(),
  }).index("by_startupId", ["startupId"]),

  // ── Tracker Websites ───────────────────────────────────────────────
  trackerWebsites: defineTable({
    startupId: v.id("startups"),
    name: v.string(),
    domain: v.optional(v.string()),
  }).index("by_startupId", ["startupId"]),

  // ── Tracker Events ─────────────────────────────────────────────────
  trackerEvents: defineTable({
    websiteId: v.id("trackerWebsites"),
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
    .index("by_websiteId", ["websiteId"])
    .index("by_websiteId_eventName", ["websiteId", "eventName"]),
});
