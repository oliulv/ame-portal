import { requireAdmin } from '@/lib/auth'
import { UserButton } from '@clerk/nextjs'
import { Sidebar } from '@/components/sidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()

  const navItems = [
    { title: 'Dashboard', href: '/admin', icon: 'LayoutDashboard' },
    { title: 'Cohorts', href: '/admin/cohorts', icon: 'Users' },
    { title: 'Goal Templates', href: '/admin/goals', icon: 'Target' },
    { title: 'Invoices', href: '/admin/invoices', icon: 'FileText' },
    { title: 'Leaderboard', href: '/admin/leaderboard', icon: 'Trophy' },
  ]

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar
        title="AccelerateMe"
        subtitle="Admin Portal"
        navItems={navItems}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-6 lg:px-6">
          <h2 className="ml-12 text-lg font-semibold lg:ml-0">Admin Portal</h2>
          <UserButton />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

