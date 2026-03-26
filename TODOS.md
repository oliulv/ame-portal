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
