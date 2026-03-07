# Accelerator OS

An operating system for running startup accelerator programs. Manages the full lifecycle — from cohort setup and founder onboarding through milestone-based funding, invoice processing, and resource curation.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Runtime**: Bun
- **Backend & Database**: Convex (real-time queries, mutations, file storage)
- **Auth**: Clerk
- **Email**: Resend
- **Deployment**: Vercel + Convex Cloud

## Getting Started

```bash
bun install
bun dev
```

Visit http://localhost:3000

## Architecture

### Admin Portal (`/admin`)

Cohort-scoped routes under `/admin/[cohortSlug]/` with a few global routes (`/admin/cohorts`, `/admin/settings`, `/admin/resources`).

- **Cohorts** — create and manage accelerator cohorts
- **Startups** — enrol startups, assign founders, manage profiles
- **Funding & Milestones** — define milestone templates, review submissions, approve payouts
- **Invoices** — review founder-submitted invoices, approve/reject, forward to Xero via email
- **Events** — schedule cohort events and link resources
- **Resources** — curate a library of videos, podcasts, books, and reading materials with drag-and-drop ordering; review founder-suggested resources
- **Leaderboard** — track startup metrics and rankings
- **Admin Management** — invite admins, delegate permissions per cohort
- **Perks** — manage partner perks available to founders

### Founder Portal (`/founder`)

Flat routes — cohort is resolved from the founder's startup.

- **Dashboard** — overview of funding, milestones, and key metrics
- **Onboarding** — guided setup (personal details, startup profile, bank details)
- **Funding & Milestones** — view allocated funding, submit milestones for review
- **Invoices** — upload invoices with receipts for reimbursement
- **Resources** — browse curated content across four media types, suggest new resources
- **Calendar** — upcoming cohort events
- **Analytics** — website traffic tracking via integrations
- **Perks** — browse available partner perks
- **Settings** — profile and startup details

### Backend (`/convex`)

All server logic lives in Convex — schema, queries, mutations, actions, and cron jobs. Custom function wrappers in `convex/functions.ts` (built with `convex-helpers`) handle structured logging and auth context.

## Development

```bash
bun run typecheck    # Type check
bun run lint         # ESLint
bun run lint:fix     # Auto-fix lint issues
bun run format       # Prettier
bun run check        # All checks
```

## Logging

- **Client**: `logClientError()` from `lib/logging.ts`
- **Server**: `logServerInfo()`, `logServerWarn()`, `logServerError()` from `lib/logging.ts`
- **Convex**: Automatic via custom function wrappers — logs success and slow executions
