'use client'

import { useEffect } from 'react'
import { useThemeStore } from '@/stores/useThemeStore'

export function ThemeWatcher() {
  const { theme } = useThemeStore()

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
  }, [theme])

  return null
}
