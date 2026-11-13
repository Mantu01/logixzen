'use client'

import { usePathname } from 'next/navigation'
import { Home, Terminal, BookOpen, Database, BarChart3, Settings, Upload } from 'lucide-react'
import Link from 'next/link'
import { ImportDialog } from '@/components/import/ImportDialog'
import { useState } from 'react'

const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/playground', label: 'Playground', icon: Terminal },
  { href: '/learn', label: 'Practice', icon: BookOpen },
  { href: '/schema', label: 'Schema', icon: Database },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
]

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [importOpen, setImportOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/home') return pathname === '/' || pathname === '/home'
    return pathname.startsWith(href)
  }

  return (
    <>
      <div className="app-shell">
        {/* Top bar */}
        <div className="app-topbar">
          <div className="logo-area">
            <span className="logo-dot" />
            <Link href="/home" className="logo-mark">logixzen</Link>
            <span className="logo-version">v0.2</span>
          </div>

          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)}>
              <Upload size={12} />
              Import
            </button>
          </div>
        </div>

        <div className="app-body">
          {/* Sidebar */}
          <div className="app-sidebar">
            <div className="sidebar-section">
              {navItems.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href}>
                    <div className={`sidebar-item transition-fast ${active ? 'active' : ''}`}>
                      <Icon />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                )
              })}
            </div>

            <div className="sidebar-spacer" />

            <div className="sidebar-section">
              <div className="sidebar-label">Tools</div>
              <Link href="/dialect-notes">
                <div className={`sidebar-item transition-fast ${pathname === '/dialect-notes' ? 'active' : ''}`}>
                  <BookOpen size={14} />
                  <span>Dialect Notes</span>
                </div>
              </Link>
              <Link href="/settings">
                <div className={`sidebar-item transition-fast ${pathname.startsWith('/settings') ? 'active' : ''}`}>
                  <Settings size={14} />
                  <span>Settings</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Main content */}
          <div className="app-main">{children}</div>
        </div>
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  )
}
