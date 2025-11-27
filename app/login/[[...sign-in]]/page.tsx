import { SignIn } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

// Helper to add timeout to auth check
async function authWithTimeout(timeoutMs = 5000) {
  try {
    const authPromise = auth()
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Auth timeout')), timeoutMs)
    )
    return (await Promise.race([authPromise, timeoutPromise])) as Awaited<ReturnType<typeof auth>>
  } catch {
    // If auth times out or fails, return null userId
    return { userId: null }
  }
}

export default async function SignInPage() {
  // Use timeout to prevent hanging - if auth check takes too long, just show login form
  const { userId } = await authWithTimeout(3000)

  // If user is authenticated, let the home route decide where to send them.
  // This avoids /login <-> / redirect loops when Supabase lookups fail.
  if (userId) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <SignIn routing="path" path="/login" signUpUrl="/login" forceRedirectUrl="/" />
      </div>
    </div>
  )
}
