import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * POST /api/user/setup
 * Creates a user record in Supabase if authenticated with Clerk but no record exists
 */
export async function POST() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Test database connection first
    const { error: testError, data: testData } = await supabase.from('users').select('id').limit(1)
    if (testError) {
      console.error('Database connection test failed:', {
        error: testError,
        message: testError.message,
        code: testError.code,
        details: testError.details,
        hint: testError.hint,
        hasSecret: !!process.env.SUPABASE_SECRET,
        secretPrefix: process.env.SUPABASE_SECRET?.substring(0, 10),
      })

      // Check if it's an authentication error
      if (testError.message === 'Internal server error.' && !testError.code) {
        return NextResponse.json(
          {
            error: 'Database authentication failed',
            details:
              'The SUPABASE_SECRET key may not have service_role permissions. Please verify you are using the service_role key from Supabase Dashboard → Settings → API → service_role (secret key). It should be a JWT token starting with "eyJ".',
            troubleshooting:
              'If you see a key starting with "sb_secret_", that is not the service_role key. You need the actual service_role JWT token.',
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        {
          error: 'Database connection failed',
          details: testError.message,
          code: testError.code,
        },
        { status: 500 }
      )
    }

    console.warn('Database connection test successful, can read', testData?.length || 0, 'users')

    // Check if user already exists
    const { data: existingUser, error: queryError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single()

    if (queryError && queryError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is expected if user doesn't exist
      console.error('Error querying user:', queryError)
    }

    if (existingUser) {
      return NextResponse.json(
        { message: 'User already exists', userId: existingUser.id, role: existingUser.role },
        { status: 200 }
      )
    }

    // Try to create the user record
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        role: 'founder', // Default role, admins can be updated manually
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating user:', {
        error,
        userId,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
      })

      // If it's a unique constraint violation, user might have been created in race condition
      if (error.code === '23505') {
        // User already exists (race condition), fetch it
        const { data: user } = await supabase
          .from('users')
          .select('id, role')
          .eq('id', userId)
          .single()

        if (user) {
          return NextResponse.json(
            { message: 'User created (race condition resolved)', userId: user.id },
            { status: 200 }
          )
        }
      }

      return NextResponse.json(
        {
          error: 'Failed to create user',
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'User created successfully', userId: newUser.id },
      { status: 200 }
    )
  } catch (err) {
    console.error('Unexpected error in user setup:', err)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
