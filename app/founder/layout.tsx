import { requireFounder } from '@/lib/auth'
import { UserButton } from '@clerk/nextjs'
import { Sidebar } from '@/components/sidebar'

export default async function FounderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireFounder()

  const navItems = [
    { title: 'Dashboard', href: '/founder/dashboard', icon: 'LayoutDashboard' },
    { title: 'Goals', href: '/founder/goals', icon: 'Target' },
    { title: 'Invoices', href: '/founder/invoices', icon: 'FileText' },
  ]

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar
        title="AccelerateMe"
        subtitle="Founder Portal"
        navItems={navItems}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-6 lg:px-6">
          <h2 className="ml-12 text-lg font-semibold lg:ml-0">Founder Portal</h2>
          <UserButton />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

