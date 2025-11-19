'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Target,
  FileText,
  Trophy,
  Menu,
  LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

interface NavItem {
  title: string
  href: string
  icon: string
}

interface SidebarProps {
  title: string
  subtitle: string
  navItems: NavItem[]
}

const iconMap: Record<string, LucideIcon> = {
  'LayoutDashboard': LayoutDashboard,
  'Users': Users,
  'Target': Target,
  'FileText': FileText,
  'Trophy': Trophy,
}

function SidebarContent({ title, subtitle, navItems, onLinkClick }: SidebarProps & { onLinkClick?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      {/* Logo/Brand */}
      <div className="border-b px-6 py-5">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = iconMap[item.icon] || LayoutDashboard

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          AccelerateMe Internal Tool
        </p>
      </div>
    </div>
  )
}

export function Sidebar({ title, subtitle, navItems }: SidebarProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed left-4 top-4 z-40 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent
              title={title}
              subtitle={subtitle}
              navItems={navItems}
              onLinkClick={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden fixed left-0 top-0 z-30 h-screen w-64 flex-col border-r bg-card lg:flex">
        <SidebarContent title={title} subtitle={subtitle} navItems={navItems} />
      </aside>
    </>
  )
}
