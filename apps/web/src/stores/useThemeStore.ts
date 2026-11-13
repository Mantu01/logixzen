import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme } from '@/contexts/ThemeContext'

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'logixzen-theme',
    },
  ),
)
