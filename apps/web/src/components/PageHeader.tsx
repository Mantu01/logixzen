'use client'

import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/home': 'Home',
  '/playground': 'Playground',
  '/learn': 'Practice',
  '/schema': 'Schema Explorer',
  '/progress': 'Progress',
  '/settings': 'Settings',
  '/dialect-notes': 'Dialect Notes',
}

export function PageHeader({ titleOverride }: { titleOverride?: string }) {
  const pathname = usePathname()
  const title = titleOverride || pageTitles[pathname] || 'LogixZen'

  return (
    <div className="page-header">
      <span className="page-breadcrumb">{title}</span>
    </div>
  )
}
