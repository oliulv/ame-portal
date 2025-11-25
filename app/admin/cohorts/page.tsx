import { getCurrentUser } from '@/lib/auth'
import { CohortsPageClient } from './cohorts-page-client'

export default async function CohortsPage() {
  const user = await getCurrentUser()
  const isSuperAdmin = user?.role === 'super_admin'

  return <CohortsPageClient isSuperAdmin={isSuperAdmin} />
}
