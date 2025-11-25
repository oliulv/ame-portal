import { createClient } from '@supabase/supabase-js'

/**
 * Admin client with secret key for server-side operations
 * that require elevated permissions (bypassing RLS).
 * Use sparingly and only in server-side code.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseSecret = process.env.SUPABASE_SECRET

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is not set')
  }

  if (!supabaseSecret) {
    throw new Error('SUPABASE_SECRET environment variable is not set')
  }

  return createClient(supabaseUrl, supabaseSecret)
}
