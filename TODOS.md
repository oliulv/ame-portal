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

## Rename `weeklyValues` Field in `scoring.test.ts`

**What:** Test data in `convex/lib/scoring.test.ts` uses the key `weeklyValues` inside a `revenue:` object to represent week-over-week MRR growth rates, which is misleading. Rename to `weeklyMrrGrowth` next time those tests are touched.

**Why:** The misleading name was a contributor to the MRR-vs-weekly-revenue copy confusion the fix PR addressed. Low priority, but worth cleaning up to prevent the same confusion resurfacing in reviews.

**Depends on:** Nothing.

## React Component + E2E Tests

**What:** Add component tests (happy-dom + React Testing Library) for key UI components and E2E tests (Playwright) for critical user flows (login, invoice submission, leaderboard).

**Why:** UI regressions are currently caught only by manual QA. Component tests catch rendering bugs; E2E tests catch integration issues across the full stack.

**Depends on:** `happy-dom`, `@testing-library/react`, and Playwright setup.
