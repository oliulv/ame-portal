/**
 * One-off migration: backfill `connectedByUserId` on legacy
 * integrationConnections rows where the field was never set.
 *
 * Root cause of the legacy data: earlier versions of storeGithubConnection
 * (or an older init path) inserted connections without `connectedByUserId`.
 * The founder whose GitHub is attached can no longer see "Your account" or
 * disconnect, because `fullStatus.myGithub` matches by connectedByUserId.
 *
 * Matching strategies, applied in order (highest confidence first):
 *   1. EXACT_GITHUB_USERNAME — founderProfile.githubUsername equals
 *      connection.accountName (case-insensitive). Unambiguous when it hits.
 *   2. SOLE_FOUNDER — exactly one founderProfile on the startup. The
 *      connection almost certainly belongs to that founder since no one
 *      else is there to own it.
 *   3. SKIP_AMBIGUOUS — multiple founders, no username match. Report all
 *      candidates so a human can pick one via the `manual` mutation.
 *   4. SKIP_NO_FOUNDERS — startup has zero founderProfiles. Orphan.
 *
 * Run flow:
 *   npx convex run migrations/backfillConnectedByUserId:dryRun '{}'
 *   (review report, confirm with user)
 *   npx convex run migrations/backfillConnectedByUserId:apply '{"confirm":"yes"}'
 */
import { v } from 'convex/values'
import { internalMutation, internalQuery } from '../functions'

type LegacyRow = {
  connectionId: string
  accountName: string
  startupId: string
  startupName: string | null
}

type MatchCandidate = {
  founderUserId: string
  founderName: string
  founderGithubUsername: string
  founderEmail: string
}

type MatchReason =
  | 'EXACT_GITHUB_USERNAME'
  | 'SOLE_FOUNDER'
  | 'NAME_SUBSTRING_UNIQUE'
  | 'SKIP_AMBIGUOUS'
  | 'SKIP_NO_FOUNDERS'

type ReportRow = {
  connectionId: string
  accountName: string
  startupId: string
  startupName: string | null
  reason: MatchReason
  status: 'READY_TO_APPLY' | 'SKIP'
  candidates: MatchCandidate[]
  chosenFounderUserId?: string
}

/**
 * Shared matcher used by both dryRun and apply so the two CAN'T diverge.
 */
async function findLegacyRowsWithCandidates(ctx: {
  db: any
}): Promise<{ rows: ReportRow[]; legacy: LegacyRow[] }> {
  const allConns = await ctx.db.query('integrationConnections').collect()
  const legacyConns = allConns.filter(
    (c: any) =>
      c.provider === 'github' &&
      c.isActive &&
      !c.connectedByUserId &&
      typeof c.accountName === 'string' &&
      c.accountName.length > 0
  )

  const rows: ReportRow[] = []
  const legacy: LegacyRow[] = []

  for (const conn of legacyConns) {
    const startup = await ctx.db.get(conn.startupId)
    const startupName = startup?.name ?? null

    legacy.push({
      connectionId: conn._id,
      accountName: conn.accountName,
      startupId: conn.startupId,
      startupName,
    })

    const profiles = await ctx.db
      .query('founderProfiles')
      .withIndex('by_startupId', (q: any) => q.eq('startupId', conn.startupId))
      .collect()

    // Always compute all founders on the startup so the report shows candidates.
    const allFoundersOnStartup: MatchCandidate[] = []
    for (const p of profiles) {
      const user = await ctx.db.get(p.userId)
      allFoundersOnStartup.push({
        founderUserId: p.userId,
        founderName: p.fullName,
        founderGithubUsername: p.githubUsername ?? '',
        founderEmail: user?.email ?? p.personalEmail,
      })
    }

    // Strategy 1: exact githubUsername match.
    const normalizedConn = conn.accountName.toLowerCase()
    const usernameMatches = allFoundersOnStartup.filter(
      (c) =>
        typeof c.founderGithubUsername === 'string' &&
        c.founderGithubUsername.length > 0 &&
        c.founderGithubUsername.toLowerCase() === normalizedConn
    )

    if (usernameMatches.length === 1) {
      rows.push({
        connectionId: conn._id,
        accountName: conn.accountName,
        startupId: conn.startupId,
        startupName,
        reason: 'EXACT_GITHUB_USERNAME',
        status: 'READY_TO_APPLY',
        candidates: usernameMatches,
        chosenFounderUserId: usernameMatches[0].founderUserId,
      })
      continue
    }

    // Strategy 2: sole founder on the startup.
    if (allFoundersOnStartup.length === 1) {
      rows.push({
        connectionId: conn._id,
        accountName: conn.accountName,
        startupId: conn.startupId,
        startupName,
        reason: 'SOLE_FOUNDER',
        status: 'READY_TO_APPLY',
        candidates: allFoundersOnStartup,
        chosenFounderUserId: allFoundersOnStartup[0].founderUserId,
      })
      continue
    }

    // Strategy 3: multiple founders, no username match — require human decision.
    if (allFoundersOnStartup.length > 1) {
      rows.push({
        connectionId: conn._id,
        accountName: conn.accountName,
        startupId: conn.startupId,
        startupName,
        reason: 'SKIP_AMBIGUOUS',
        status: 'SKIP',
        candidates: allFoundersOnStartup,
      })
      continue
    }

    // Strategy 4: zero founders — nothing we can do.
    rows.push({
      connectionId: conn._id,
      accountName: conn.accountName,
      startupId: conn.startupId,
      startupName,
      reason: 'SKIP_NO_FOUNDERS',
      status: 'SKIP',
      candidates: [],
    })
  }

  return { rows, legacy }
}

/**
 * Preview what the backfill WOULD do. No writes.
 */
export const dryRun = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { rows, legacy } = await findLegacyRowsWithCandidates(ctx)
    const ready = rows.filter((r) => r.status === 'READY_TO_APPLY')
    const skip = rows.filter((r) => r.status === 'SKIP')
    return {
      totalLegacyRows: legacy.length,
      readyToApply: ready.length,
      skipped: skip.length,
      byReason: {
        EXACT_GITHUB_USERNAME: rows.filter((r) => r.reason === 'EXACT_GITHUB_USERNAME').length,
        SOLE_FOUNDER: rows.filter((r) => r.reason === 'SOLE_FOUNDER').length,
        SKIP_AMBIGUOUS: rows.filter((r) => r.reason === 'SKIP_AMBIGUOUS').length,
        SKIP_NO_FOUNDERS: rows.filter((r) => r.reason === 'SKIP_NO_FOUNDERS').length,
      },
      report: rows,
    }
  },
})

/**
 * Apply the backfill. Requires `confirm: "yes"` to run — prevents accidental
 * invocation. Applies:
 *   - all rows classified READY_TO_APPLY by the dry-run matcher, AND
 *   - any explicit `overrides` for SKIP_AMBIGUOUS rows where a human picked
 *     the correct founder.
 * Rows without an override AND not READY_TO_APPLY are left untouched.
 */
export const apply = internalMutation({
  args: {
    confirm: v.string(),
    overrides: v.optional(
      v.array(
        v.object({
          connectionId: v.id('integrationConnections'),
          founderUserId: v.id('users'),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== 'yes') {
      return { error: 'confirm must be exactly "yes" to apply changes' }
    }
    const overridesMap = new Map<string, string>()
    for (const o of args.overrides ?? []) {
      overridesMap.set(o.connectionId, o.founderUserId)
    }

    const { rows } = await findLegacyRowsWithCandidates(ctx)
    const applied: Array<{
      connectionId: string
      connectedByUserId: string
      source: 'auto' | 'override'
    }> = []
    const skipped: Array<{ connectionId: string; reason: string }> = []

    // Safety: verify each override references a connection that is in the
    // legacy set AND the chosen founder has a founderProfile on that
    // startup. Prevents pointing a connection at a random user.
    for (const r of rows) {
      const override = overridesMap.get(r.connectionId)
      if (override) {
        const candidateIds = new Set(r.candidates.map((c) => c.founderUserId))
        const sameStartupFounders =
          r.candidates.length > 0
            ? candidateIds
            : new Set(
                (
                  await ctx.db
                    .query('founderProfiles')
                    .withIndex('by_startupId', (q) => q.eq('startupId', r.startupId as any))
                    .collect()
                ).map((p: any) => p.userId)
              )
        if (!sameStartupFounders.has(override as any)) {
          skipped.push({
            connectionId: r.connectionId,
            reason: 'override user is not a founder on this startup',
          })
          continue
        }
        await ctx.db.patch(r.connectionId as any, {
          connectedByUserId: override as any,
        })
        applied.push({
          connectionId: r.connectionId,
          connectedByUserId: override,
          source: 'override',
        })
        continue
      }
      if (r.status === 'READY_TO_APPLY' && r.chosenFounderUserId) {
        await ctx.db.patch(r.connectionId as any, {
          connectedByUserId: r.chosenFounderUserId as any,
        })
        applied.push({
          connectionId: r.connectionId,
          connectedByUserId: r.chosenFounderUserId,
          source: 'auto',
        })
        continue
      }
      skipped.push({ connectionId: r.connectionId, reason: r.reason })
    }
    return {
      appliedCount: applied.length,
      skippedCount: skipped.length,
      applied,
      skipped,
    }
  },
})
