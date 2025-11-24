import { SignIn } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function SignInPage() {
  const { userId } = await auth()
  
  // If user is authenticated, let the home route decide where to send them.
  // This avoids /login <-> / redirect loops when Supabase lookups fail.
  if (userId) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <SignIn 
          routing="path"
          path="/login"
          signUpUrl="/login"
          afterSignInUrl="/"
        />
      </div>
    </div>
  )
}

