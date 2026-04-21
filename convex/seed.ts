import { internalMutation, internalAction } from './functions'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { v } from 'convex/values'

// ── Test User Clerk IDs (dev Clerk instance) ─────────────────────────
// TODO: Fill in actual Clerk IDs
const CLERK_IDS = {
  super_admin: 'user_3A6qOM3s1o7PGR61JPGkX7CgzKo',
  admin: 'user_3AZadW7ezwPpAhPnzlOlG1D4zMN',
  founder: 'user_3AnkoO5kRQnKeQ3UrMfJPohVbxz',
}

// ── Startup definitions ──────────────────────────────────────────────
const STARTUPS = [
  {
    name: 'NexaAI',
    sector: 'AI/ML',
    stage: 'Pre-Seed',
    oneLiner: 'AI-powered customer support automation',
  },
  {
    name: 'GreenStack',
    sector: 'CleanTech',
    stage: 'Seed',
    oneLiner: 'Carbon tracking for supply chains',
  },
  {
    name: 'MediSync',
    sector: 'HealthTech',
    stage: 'Pre-Seed',
    oneLiner: 'Remote patient monitoring platform',
  },
  {
    name: 'FinFlow',
    sector: 'FinTech',
    stage: 'Seed',
    oneLiner: 'Cross-border payment infrastructure',
  },
  {
    name: 'EduVerse',
    sector: 'EdTech',
    stage: 'Pre-Seed',
    oneLiner: 'Adaptive learning platform for K-12',
  },
  { name: 'PropelHQ', sector: 'SaaS', stage: 'Seed', oneLiner: 'Revenue operations platform' },
  {
    name: 'FoodLoop',
    sector: 'FoodTech',
    stage: 'Pre-Seed',
    oneLiner: 'Food waste reduction marketplace',
  },
  {
    name: 'CyberShield',
    sector: 'Cybersecurity',
    stage: 'Pre-Seed',
    oneLiner: 'Automated threat detection for SMBs',
  },
  {
    name: 'LogiTrack',
    sector: 'Logistics',
    stage: 'Seed',
    oneLiner: 'Last-mile delivery optimization',
  },
  {
    name: 'SocialBee',
    sector: 'MarTech',
    stage: 'Pre-Seed',
    oneLiner: 'AI social media management',
  },
  {
    name: 'BuilderOS',
    sector: 'Construction Tech',
    stage: 'Pre-Seed',
    oneLiner: 'Project management for contractors',
  },
  {
    name: 'DataNest',
    sector: 'Data Infrastructure',
    stage: 'Seed',
    oneLiner: 'Data pipeline automation',
  },
]

// ── Milestone template definitions ───────────────────────────────────
const MILESTONE_TEMPLATES: Array<{
  title: string
  description: string
  amount: number
  sortOrder: number
  requireLink?: boolean
  requireFile?: boolean
}> = [
  {
    title: 'Business Plan Submission',
    description:
      'Submit a comprehensive business plan including market analysis and financial projections.',
    amount: 2000,
    sortOrder: 1,
  },
  {
    title: 'Market Validation Report',
    description: 'Complete customer discovery interviews and present market validation findings.',
    amount: 3000,
    sortOrder: 2,
  },
  {
    title: 'MVP Launch',
    description: 'Launch a minimum viable product and demonstrate core functionality.',
    amount: 5000,
    sortOrder: 3,
    requireLink: true,
  },
  {
    title: 'First Customer Acquisition',
    description: 'Acquire at least one paying customer or signed LOI.',
    amount: 5000,
    sortOrder: 4,
    requireLink: true,
  },
  {
    title: 'Growth Metrics Report',
    description: 'Present monthly growth metrics demonstrating traction.',
    amount: 5000,
    sortOrder: 5,
    requireFile: true,
  },
]

// ── Perk definitions ─────────────────────────────────────────────────
const PERKS: Array<{
  title: string
  description: string
  category: string
  providerName: string
  sortOrder: number
  isPartnership?: boolean
}> = [
  {
    title: 'AWS Activate Credits',
    description: 'Up to $5,000 in AWS credits for startups.',
    category: 'Cloud',
    providerName: 'Amazon Web Services',
    sortOrder: 1,
  },
  {
    title: 'Stripe Atlas',
    description: 'Free incorporation and banking setup.',
    category: 'Legal & Finance',
    providerName: 'Stripe',
    sortOrder: 2,
  },
  {
    title: 'HubSpot for Startups',
    description: '90% off HubSpot CRM for your first year.',
    category: 'Sales & Marketing',
    providerName: 'HubSpot',
    sortOrder: 3,
  },
  {
    title: 'Notion Team Plan',
    description: 'Free Notion Team plan for 1 year.',
    category: 'Productivity',
    providerName: 'Notion',
    sortOrder: 4,
  },
  {
    title: 'Legal Consultation',
    description: '5 hours of free legal advice from partner law firm.',
    category: 'Legal & Finance',
    providerName: 'AccelerateME Partners',
    sortOrder: 5,
    isPartnership: true,
  },
  {
    title: 'Figma Professional',
    description: 'Free Figma Professional plan for 1 year.',
    category: 'Design',
    providerName: 'Figma',
    sortOrder: 6,
  },
]

// ── Cohort event definitions ─────────────────────────────────────────
const COHORT_EVENTS = [
  {
    title: 'Cohort 12 Kickoff',
    description: 'Welcome session and orientation for all Cohort 12 startups.',
    date: '2025-09-15T09:00:00Z',
    sortOrder: 1,
  },
  {
    title: 'Workshop: Fundraising 101',
    description: 'Learn the fundamentals of raising your first round.',
    date: '2025-10-01T14:00:00Z',
    sortOrder: 2,
  },
  {
    title: 'Investor Networking Night',
    description: 'Meet and pitch to our network of angel investors and VCs.',
    date: '2025-11-15T18:00:00Z',
    sortOrder: 3,
  },
  {
    title: 'Demo Day',
    description: 'Present your startup to investors, media, and the tech community.',
    date: '2026-03-20T10:00:00Z',
    sortOrder: 4,
  },
]

// ── Invoice definitions (per startup, varied statuses) ───────────────
const INVOICE_VENDORS = [
  'Amazon Web Services',
  'Google Cloud Platform',
  'Figma Inc.',
  'Notion Labs',
  'DigitalOcean',
  'Vercel Inc.',
  'Adobe Systems',
  'Slack Technologies',
  'GitHub Inc.',
  'Intercom',
]

const INVOICE_CATEGORIES = [
  'Cloud Infrastructure',
  'Software Subscriptions',
  'Design Tools',
  'Marketing',
  'Office Supplies',
  'Professional Services',
]

/**
 * Create a minimal valid PDF as a Blob for storage seeding.
 */
function makeDummyPdfBlob(): Blob {
  const pdf = `%PDF-1.0
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Seed function for preview/staging deployments.
 * Creates a realistic dataset exercising every table in the schema.
 *
 * Idempotent: returns early if users table is non-empty.
 * Protected: throws if running in production.
 *
 * Referenced via: --preview-run 'seed:default_'
 */
export const default_ = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Production guard
    if (process.env.APP_URL === 'https://www.ameportal.com') {
      throw new Error('SAFETY: Cannot run seed in production!')
    }

    // Idempotency check
    const existingUsers = await ctx.db.query('users').first()
    if (existingUsers) {
      console.log('Seed: users table is non-empty, skipping.')
      return
    }

    // ── 1. Create users ──────────────────────────────────────────────
    const superAdminId = await ctx.db.insert('users', {
      clerkId: CLERK_IDS.super_admin,
      role: 'super_admin',
      email: 'victoria.chen@accelerateme.test',
      fullName: 'Victoria Chen',
    })

    const adminId = await ctx.db.insert('users', {
      clerkId: CLERK_IDS.admin,
      role: 'admin',
      email: 'james.mitchell@accelerateme.test',
      fullName: 'James Mitchell',
    })

    const founderId = await ctx.db.insert('users', {
      clerkId: CLERK_IDS.founder,
      role: 'founder',
      email: 'sarah.thompson@nexaai.test',
      fullName: 'Sarah Thompson',
    })

    // ── 2. Create cohort ─────────────────────────────────────────────
    const cohortId = await ctx.db.insert('cohorts', {
      name: 'Cohort 12',
      slug: 'cohort-12',
      yearStart: 2025,
      yearEnd: 2026,
      label: 'Sep 2025 - Mar 2026',
      isActive: true,
      fundingBudget: 240000,
      baseFunding: 20000,
    })

    // ── 3. Assign admins to cohort ───────────────────────────────────
    await ctx.db.insert('adminCohorts', { userId: superAdminId, cohortId })
    await ctx.db.insert('adminCohorts', { userId: adminId, cohortId })

    // ── 4. Create perks ──────────────────────────────────────────────
    const perkIds: string[] = []
    for (const perk of PERKS) {
      const id = await ctx.db.insert('perks', {
        ...perk,
        isActive: true,
        isPartnership: perk.isPartnership ?? false,
      })
      perkIds.push(id)
    }

    // ── 5. Create milestone templates ────────────────────────────────
    const templateIds: string[] = []
    for (const tmpl of MILESTONE_TEMPLATES) {
      const id = await ctx.db.insert('milestoneTemplates', {
        cohortId,
        title: tmpl.title,
        description: tmpl.description,
        amount: tmpl.amount,
        sortOrder: tmpl.sortOrder,
        isActive: true,
        requireLink: tmpl.requireLink ?? false,
        requireFile: tmpl.requireFile ?? false,
      })
      templateIds.push(id)
    }

    // ── 6. Create cohort events ──────────────────────────────────────
    const eventIds: string[] = []
    for (const evt of COHORT_EVENTS) {
      const id = await ctx.db.insert('cohortEvents', {
        cohortId,
        title: evt.title,
        description: evt.description,
        date: evt.date,
        lumaEmbedUrl: `https://lu.ma/embed/evt-${slugify(evt.title)}`,
        sortOrder: evt.sortOrder,
        isActive: true,
      })
      eventIds.push(id)
    }

    // ── 7. Create startups and related data ──────────────────────────
    const startupIds: string[] = []
    const founderNames = [
      'Sarah Thompson',
      'Alex Rivera',
      'Priya Sharma',
      'Marcus Johnson',
      'Emma Larsson',
      'David Kim',
      'Fatima Al-Hassan',
      'Tom Bradley',
      'Lisa Chen',
      "Ryan O'Connor",
      'Aisha Patel',
      'Noah Fischer',
    ]

    const onboardingStatuses: Array<'pending' | 'in_progress' | 'completed'> = [
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
      'in_progress',
      'in_progress',
      'in_progress',
      'pending',
      'pending',
      'pending',
    ]

    const milestoneStatuses: Array<'waiting' | 'submitted' | 'approved'> = [
      'approved',
      'approved',
      'submitted',
      'waiting',
      'waiting',
    ]

    for (let i = 0; i < STARTUPS.length; i++) {
      const s = STARTUPS[i]
      const startupSlug = slugify(s.name)
      const onboardingStatus = onboardingStatuses[i]

      // Create startup
      const startupId = await ctx.db.insert('startups', {
        cohortId,
        name: s.name,
        slug: startupSlug,
        stage: s.stage,
        sector: s.sector,
        onboardingStatus,
        fundingDeployed: onboardingStatus === 'completed' ? Math.floor(Math.random() * 15000) : 0,
      })
      startupIds.push(startupId)

      // Create startup profile
      await ctx.db.insert('startupProfiles', {
        startupId,
        oneLiner: s.oneLiner,
        description: `${s.name} is building the future of ${s.sector.toLowerCase()}. ${s.oneLiner}.`,
        industry: s.sector,
        location: i % 3 === 0 ? 'London, UK' : i % 3 === 1 ? 'Manchester, UK' : 'Edinburgh, UK',
        initialCustomers: Math.floor(Math.random() * 50),
        initialRevenue: Math.floor(Math.random() * 10000),
      })

      // Create founder profile (first startup uses the actual founder test user)
      const founderUserId = i === 0 ? founderId : founderId // All map to the same founder test user
      const founderName = founderNames[i]

      await ctx.db.insert('founderProfiles', {
        userId: founderUserId,
        startupId,
        fullName: founderName,
        personalEmail: `${slugify(founderName)}@test.dev`,
        city: 'London',
        country: 'United Kingdom',
        onboardingStatus,
      })

      // Create bank details for completed startups
      if (onboardingStatus === 'completed') {
        await ctx.db.insert('bankDetails', {
          startupId,
          accountHolderName: `${s.name} Ltd`,
          sortCode: `${String(10 + i).padStart(2, '0')}-00-00`,
          accountNumber: `${String(10000000 + i)}`,
          bankName: 'Test Bank',
        })
      }

      // Create milestones from templates
      for (let j = 0; j < templateIds.length; j++) {
        const tmpl = MILESTONE_TEMPLATES[j]
        // Vary milestone progress based on startup index
        let status: 'waiting' | 'submitted' | 'approved' = 'waiting'
        if (onboardingStatus === 'completed') {
          status = milestoneStatuses[j]
        } else if (onboardingStatus === 'in_progress' && j === 0) {
          status = 'submitted'
        }

        // Stagger approvedAt within the 28-day leaderboard window so seeded
        // rows contribute to the milestones category on fresh dev/preview DBs.
        // Without this, approved rows would have approvedAt=undefined and
        // get dropped by the leaderboard's belt+braces filter.
        const approvedAt =
          status === 'approved'
            ? new Date(Date.now() - (3 + j * 4) * 24 * 60 * 60 * 1000).toISOString()
            : undefined

        const milestoneId = await ctx.db.insert('milestones', {
          startupId,
          milestoneTemplateId: templateIds[j] as any,
          title: tmpl.title,
          description: tmpl.description,
          amount: tmpl.amount,
          status,
          approvedAt,
          sortOrder: tmpl.sortOrder,
          requireLink: tmpl.requireLink ?? false,
          requireFile: tmpl.requireFile ?? false,
        })

        // Write a matching 'approved' milestoneEvents row so backfill and
        // any event-walking code sees a clean audit trail.
        if (status === 'approved') {
          await ctx.db.insert('milestoneEvents', {
            milestoneId,
            action: 'approved',
            userId: superAdminId,
          })
        }
      }

      // Create invitation (accepted for completed/in_progress startups)
      await ctx.db.insert('invitations', {
        startupId,
        email: `${slugify(founderName)}@test.dev`,
        fullName: founderName,
        token: `token-${startupSlug}-${Date.now()}`,
        role: 'founder',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        acceptedAt: onboardingStatus !== 'pending' ? new Date().toISOString() : undefined,
        createdByAdminId: superAdminId,
      })
    }

    // ── 8. Create perk claims (a few startups claimed some perks) ────
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        await ctx.db.insert('perkClaims', {
          perkId: perkIds[j] as any,
          userId: founderId,
          startupId: startupIds[i] as any,
          claimedAt: new Date().toISOString(),
        })
      }
    }

    // ── 9. Create event registrations ────────────────────────────────
    // Register founder for first two events
    for (let i = 0; i < 2; i++) {
      await ctx.db.insert('eventRegistrations', {
        eventId: eventIds[i] as any,
        userId: founderId,
        registeredAt: new Date().toISOString(),
      })
    }

    // ── 10. Create sample metrics data ───────────────────────────────
    const metricKeys = ['mrr', 'customers', 'website_visitors']
    for (let i = 0; i < 4; i++) {
      const startupId = startupIds[i] as any
      for (const metricKey of metricKeys) {
        for (let month = 1; month <= 6; month++) {
          const baseValue = metricKey === 'mrr' ? 500 : metricKey === 'customers' ? 5 : 100
          await ctx.db.insert('metricsData', {
            startupId,
            provider: 'manual',
            metricKey,
            value: baseValue * month * (1 + Math.random() * 0.5),
            timestamp: `2025-${String(8 + month).padStart(2, '0')}-01T00:00:00Z`,
            window: 'monthly',
          })
        }
      }
    }

    // ── 11. Create tracker websites and events ───────────────────────
    for (let i = 0; i < 3; i++) {
      const startupId = startupIds[i] as any
      const websiteId = await ctx.db.insert('trackerWebsites', {
        startupId,
        name: `${STARTUPS[i].name} Website`,
        domain: `${slugify(STARTUPS[i].name)}.com`,
        lastEventAt: new Date().toISOString(),
      })

      // Create a few tracker events per website
      const pages = ['/', '/pricing', '/about', '/signup', '/blog']
      for (const page of pages) {
        await ctx.db.insert('trackerEvents', {
          websiteId,
          eventName: 'pageview',
          url: `https://${slugify(STARTUPS[i].name)}.com${page}`,
          country: 'GB',
          device: 'desktop',
          browser: 'Chrome',
          os: 'macOS',
        })
      }
    }

    // ── 12. Create integration connections ───────────────────────────
    for (let i = 0; i < 2; i++) {
      await ctx.db.insert('integrationConnections', {
        startupId: startupIds[i] as any,
        provider: 'stripe',
        accountId: `acct_test_${slugify(STARTUPS[i].name)}`,
        accountName: `${STARTUPS[i].name} Stripe`,
        status: 'active',
        isActive: true,
        connectedAt: new Date().toISOString(),
      })
    }

    // ── 13. Schedule invoice seeding (needs action for storage.store) ──
    // Pass the first 6 startup IDs (completed onboarding) and the admin ID
    await ctx.scheduler.runAfter(0, internal.seed.seedInvoicesAction, {
      startupIds: startupIds.slice(0, 6),
      startupNames: STARTUPS.slice(0, 6).map((s) => s.name),
      adminUserId: superAdminId,
      founderUserId: founderId,
    })

    console.log('Seed complete: created cohort with 12 startups and related data.')
  },
})

/**
 * Internal action to seed invoices with dummy PDF files in storage.
 * Scheduled by the main seed mutation because mutations cannot call storage.store().
 */
export const seedInvoicesAction = internalAction({
  args: {
    startupIds: v.array(v.string()),
    startupNames: v.array(v.string()),
    adminUserId: v.string(),
    founderUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const invoiceStatuses: Array<'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid'> =
      ['paid', 'paid', 'approved', 'approved', 'submitted', 'under_review', 'rejected']

    let invoiceCount = 0
    for (let i = 0; i < args.startupIds.length; i++) {
      const startupId = args.startupIds[i] as Id<'startups'>
      const startupName = args.startupNames[i]
      const numInvoices = 2 + (i % 3)

      for (let j = 0; j < numInvoices; j++) {
        invoiceCount++
        const status = invoiceStatuses[(i * 3 + j) % invoiceStatuses.length]
        const vendor = INVOICE_VENDORS[(i + j) % INVOICE_VENDORS.length]
        const category = INVOICE_CATEGORIES[(i + j) % INVOICE_CATEGORIES.length]
        const amount = [250, 499.99, 750, 1200, 1500, 2000, 3500][(i * 2 + j) % 7]
        const invoiceNum = j + 1
        const invoiceFileName = `${startupName} Invoice ${invoiceNum}.pdf`
        const month = String(9 + (j % 4)).padStart(2, '0')
        const day = String(5 + i + j * 3).padStart(2, '0')
        const invoiceDate = `2025-${month}-${day}`

        const invoiceStorageId = await ctx.storage.store(makeDummyPdfBlob())
        const receiptStorageId = await ctx.storage.store(makeDummyPdfBlob())
        const receiptFileName = `${startupName} Invoice ${invoiceNum} Receipt 1.pdf`

        await ctx.runMutation(internal.seed.insertInvoice, {
          startupId,
          uploadedByUserId: args.founderUserId,
          vendorName: vendor,
          invoiceDate,
          amountGbp: amount,
          category,
          description: `${vendor} - ${category} expense for ${startupName}`,
          storageId: invoiceStorageId,
          fileName: invoiceFileName,
          receiptStorageIds: [receiptStorageId],
          receiptFileNames: [receiptFileName],
          status,
          approvedByAdminId:
            status === 'approved' || status === 'paid' ? args.adminUserId : undefined,
          approvedAt:
            status === 'approved' || status === 'paid'
              ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
              : undefined,
          paidAt:
            status === 'paid'
              ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
              : undefined,
          adminComment:
            status === 'rejected'
              ? 'This expense does not appear to be related to the startup. Please provide additional context.'
              : undefined,
        })
      }
    }

    console.log(`Seed invoices: created ${invoiceCount} invoices.`)
  },
})

/**
 * Internal mutation to insert a single invoice record (called from seedInvoicesAction).
 */
export const insertInvoice = internalMutation({
  args: {
    startupId: v.string(),
    uploadedByUserId: v.string(),
    vendorName: v.string(),
    invoiceDate: v.string(),
    amountGbp: v.number(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    storageId: v.string(),
    fileName: v.string(),
    receiptStorageIds: v.array(v.string()),
    receiptFileNames: v.array(v.string()),
    status: v.string(),
    approvedByAdminId: v.optional(v.string()),
    approvedAt: v.optional(v.string()),
    paidAt: v.optional(v.string()),
    adminComment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('invoices', {
      startupId: args.startupId as Id<'startups'>,
      uploadedByUserId: args.uploadedByUserId as Id<'users'>,
      vendorName: args.vendorName,
      invoiceDate: args.invoiceDate,
      amountGbp: args.amountGbp,
      category: args.category,
      description: args.description,
      storageId: args.storageId as Id<'_storage'>,
      fileName: args.fileName,
      receiptStorageIds: args.receiptStorageIds as Id<'_storage'>[],
      receiptFileNames: args.receiptFileNames,
      status: args.status as 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid',
      approvedByAdminId: args.approvedByAdminId
        ? (args.approvedByAdminId as Id<'users'>)
        : undefined,
      approvedAt: args.approvedAt,
      paidAt: args.paidAt,
      adminComment: args.adminComment,
    })
  },
})
