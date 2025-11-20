import { requireFounder } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireFounder()
  const supabase = await createClient()

  // Check if founder has already completed onboarding
  const { data: founderProfile } = await supabase
    .from('founder_profiles')
    .select('onboarding_status')
    .eq('user_id', user.id)
    .single()

  // If onboarding is already completed, redirect to dashboard
  if (founderProfile?.onboarding_status === 'completed') {
    redirect('/founder/dashboard')
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Page content */}
      <main className="flex-1">{children}</main>
    </div>
  )
}

