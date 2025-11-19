import { createClient } from '@supabase/supabase-js'

/**
 * Admin client with secret key for server-side operations
 * that require elevated permissions (bypassing RLS).
 * Use sparingly and only in server-side code.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET!
  )
}

