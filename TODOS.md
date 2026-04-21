# TODOS

## Social Media Scoring (6th Category)

**What:** Add social follower growth (Twitter, LinkedIn, Instagram) as the 6th scoring category in the leaderboard engine. Weights redistribute from 5 categories to 6: revenue 22%, traffic 18%, GitHub 16%, social 16%, updates 15%, milestones 13%.

**Why:** Completes the scoring model. Social presence and growth matter for early-stage startups trying to build brand. Currently excluded from v1 because the Apify-based scraping doesn't work reliably.

**Context:** Excluded per design doc Premise 4. A separate scraping solution is being sourced externally. Integration pattern: store in `metricsData` with `provider: "social"`, sync via dedicated cron. The `socialProfiles` table and basic UI already exist from the current branch — just need reliable data flowing in.

**Depends on:** External scraping solution delivery; stable v1 scoring engine.

**Qualified threshold:** Changes from 3/5 to 3/6 when social is added.

## Clickable Startup Profiles from Leaderboard

**What:** From the founder leaderboard, founders should be able to click into competitor startup profiles to see their public performance data.

**Why:** Competitive motivation is a core product thesis — founders need to see what peers are doing to stay motivated and learn. Currently the leaderboard shows rank/score/momentum but you can't drill into any startup.

**Context:** Requires a new route `/founder/startups/[slug]` with a public profile view. Key design decision: what data is visible to other founders? Candidates: overall score, category breakdown (radar chart), momentum history, GitHub activity level (not raw commits), update streak. Revenue and specific metrics should likely be hidden unless the startup opts in. Access control: any authenticated founder in the same cohort can view profiles of cohort peers.

**Depends on:** Leaderboard + analytics PR landing first; design decision on data visibility.

**Blocked by:** Need to decide privacy model — opt-in detailed metrics vs. score-only default.

## API Route Integration Tests

**What:** Add integration tests for Next.js API routes (e.g. `/api/webhooks/stripe`, `/api/cron/*`). Requires mocking HTTP requests and Convex client calls.

**Why:** API routes contain auth checks, webhook signature verification, and orchestration logic that unit tests can't cover. Currently untested.

**Depends on:** Test infrastructure for mocking `NextRequest`/`NextResponse` and Convex client.

## Convex Handler Tests

**What:** Add tests for Convex mutations/queries/actions using the `convex-test` package. Covers handler-level logic (auth guards, DB reads/writes, scheduler calls).

**Why:** Business logic in Convex handlers (invoice creation, milestone approval, notification triggers) is only testable with a Convex test harness that simulates the DB and scheduler.

**Depends on:** `convex-test` package installation and configuration.

## Timezone-Aware Week Boundaries for Weekly Updates

**What:** `convex/lib/dateUtils.ts:getMonday` uses UTC Mondays, so a founder in UTC+8 submitting Monday 7am local time lands in UTC Sunday and counts for the previous week. Consider per-user timezone preference or a more forgiving submission window.

**Why:** Live streak now reads directly from `weeklyUpdates`, so any misclassification of `weekOf` directly affects the displayed streak. The problem was latent when a cron owned the value; it is observable now.

**Depends on:** Decision on whether to store a per-user timezone or just widen the submit window.

## Audit Log for Scoped Admin Approvals

**What:** `adminPermissions` rows now support `startupId` scoping, but there is no audit log of which admin approved which milestone/invoice under which scope. Add a table that records `(adminUserId, action, targetId, permissionRowId, timestamp)` on every approval path.

**Why:** Scoped permissions make delegation easier, which means more people approving more things. A trail matters once non-super-admins start acting on behalf of specific startups.

**Depends on:** Agreement on retention policy and admin-facing UI for reviewing the log.

## React Component + E2E Tests

**What:** Add component tests (happy-dom + React Testing Library) for key UI components and E2E tests (Playwright) for critical user flows (login, invoice submission, leaderboard).

**Why:** UI regressions are currently caught only by manual QA. Component tests catch rendering bugs; E2E tests catch integration issues across the full stack.

**Depends on:** `happy-dom`, `@testing-library/react`, and Playwright setup.

## Tracker Anti-Gaming (IP + Session Verification)

**What:** The in-house traffic tracker accepts session pings without verifying the source. Startups can script fake sessions to inflate the `tracker/sessions` metric that drives the Traffic category on the leaderboard (up to 20% of total score). At minimum: hash + store the source IP per event, rate-limit per IP per day, and reject obviously synthetic patterns (burst of N sessions from one IP, no pageview follow-up, headless UA). Longer term: proof-of-work beacon, server-side validation against the tracker script's origin header, or an anomaly-detection job that flags suspicious spikes.

**Why:** At least one startup is already trying to game the leaderboard for extra funding. A 20%-weighted category that accepts unvalidated numeric inputs is a direct incentive to cheat. This undermines the whole "funds flow to outliers" thesis and corrodes trust in the rankings.

**Context:** Current ingest in `convex/metrics.ts` around the `sessions` metric bucket counts unique `sessionId` values per day from `trackerEvents`. `sessionId` is client-generated, no IP is stored, no rate limit. Options: (a) add `sourceIp` field to `trackerEvents` via HTTP action that reads `x-forwarded-for`, hash it, dedupe sessions by ip-hash too; (b) add a `suspect` flag that a cron sets based on heuristics and have the leaderboard discount suspect sessions; (c) require a `verify` beacon round-trip before a session counts. Start with (a) — lowest effort, catches the naive scripters.

**Depends on:** Decision on whether to store raw IP (GDPR — probably hash only), and on how to handle the existing unvalidated history (delete, flag, or grandfather).

## Completed

### UI Cleanups Deferred From Leaderboard Scoring PR
**Completed:** 2026-04-21. All 5 items shipped as the UI polish follow-up PR (FAV column removal, clickable GitHub usernames, Sync button height alignment, session-scoped tab caching, query ungating to kill tab-switch jump).

### Remove `consistencyBonus: 0` Placeholder From Leaderboard Return Shape
**Completed:** 2026-04-21. Field removed from `ScoreBreakdown` type and from the result-builder in `convex/leaderboard.ts` once the scoring PR had been live long enough for cached Vercel bundles to refresh.

### Rename `weeklyValues` Field in `scoring.test.ts`
**Completed:** v0.1.2.0 (2026-04-21). The misleading test-fixture field was removed entirely along with `computeStartupScore` + `computeConsistencyBonus` tests in the scoring correctness PR. The new `computeLeaderboardScore` tests use clearer per-category scalar inputs (no shared-shape `CategoryMetric` fixture field at all).
