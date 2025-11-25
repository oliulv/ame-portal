import { requireSuperAdmin } from '@/lib/auth'

export default async function NewCohortLayout({ children }: { children: React.ReactNode }) {
  // Only super admins can create cohorts
  await requireSuperAdmin()
  return <>{children}</>
}

