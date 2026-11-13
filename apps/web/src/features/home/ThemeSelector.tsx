'use client'

import { useThemeStore } from '@/stores/useThemeStore'

const THEMES = ['dark', 'light'] as const

export function ThemeSelector() {
  const { theme, setTheme } = useThemeStore()

  return (
    <div className="flex items-center gap-1 border border-border rounded p-0.5">
      {THEMES.map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          className={`px-2 py-0.5 text-xs font-mono rounded ${
            theme === t ? 'bg-primary text-background' : 'text-muted'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
