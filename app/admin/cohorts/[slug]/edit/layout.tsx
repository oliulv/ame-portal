import { requireSuperAdmin } from '@/lib/auth'

export default async function EditCohortLayout({ children }: { children: React.ReactNode }) {
  // Only super admins can edit cohorts
  await requireSuperAdmin()
  return <>{children}</>
}

