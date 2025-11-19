# AccelerateMe Internal Tool

Internal tool for managing cohorts, startups, founders, goals, and invoices.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with Bun
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Clerk
- **Email**: Resend
- **Storage**: Supabase Storage
- **Deployment**: Vercel

## Getting Started

See [SETUP.md](./SETUP.md) for detailed setup instructions.

Quick start:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables (copy `.env.example` to `.env.local`)

3. Run database migrations in Supabase

4. Start the development server:
   ```bash
   npm run dev
   ```

## Phase 1 Features

- ✅ Admin: Create cohorts, startups, and founders
- ✅ Admin: Send invitations to founders via Resend
- ✅ Founders: Accept invite, create account
- ✅ Founders: Complete onboarding (personal details, startup profile, bank details)
- ✅ Goals: Attach default goal templates to startups
- ✅ Goals: Manual goal status updates and admin overrides
- ✅ Invoices: Upload invoices (file + metadata)
- ✅ Invoices: Manual approval/rejection and paid status updates
- ✅ Leaderboard: Basic leaderboard using manual metrics
- ✅ Authentication and authorization with Clerk

## Project Structure

- `app/` - Next.js App Router pages and routes
- `lib/` - Utility libraries (auth, email, Supabase clients)
- `supabase/migrations/` - Database schema migrations
- `middleware.ts` - Clerk authentication middleware

## Documentation

- [Phase 1 Technical Plan](./phase-1-technical-plan.md)
- [Setup Guide](./SETUP.md)
