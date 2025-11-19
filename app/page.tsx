import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default async function Home() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Redirect based on role
  if (user.role === 'admin') {
    redirect('/admin')
  } else if (user.role === 'founder') {
    redirect('/founder/dashboard')
  }

  // Fallback
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Unknown role. Please contact support.</p>
    </div>
  )
}
