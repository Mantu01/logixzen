import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface QuestionResult {
  timestamp: number
  attempts: number
  bestTimeMs: number
  hintsUsed: number
}

export interface StreakState {
  currentStreak: number
  lastActiveDate: string
  longestStreak: number
}

export interface BadgeState {
  earned: Map<string, { timestamp: number }>
}

export interface SettingsState {
  theme: 'light' | 'dark' | 'system'
  editorFontSize: number
}

export interface ImportProgressData {
  solvedQuestions: [string, QuestionResult][]
  totalPoints: number
  streak: StreakState
  badges: [string, { timestamp: number }][]
  lastPosition: { topicId: string; questionId: string } | null
  exportedAt: string
}

interface ProgressState {
  solvedQuestions: Map<string, QuestionResult>
  totalPoints: number
  streak: StreakState
  lastPosition: { topicId: string; questionId: string } | null
  badges: BadgeState
  settings: SettingsState
}

interface ProgressActions {
  markSolved: (questionId: string, timeMs: number, hintsUsed: number) => void
  addPoints: (points: number) => void
  updateStreak: () => void
  earnBadge: (badgeId: string) => void
  saveLastPosition: (topicId: string, questionId: string) => void
  exportProgress: () => string
  importProgress: (data: string) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setFontSize: (size: number) => void
  resetProgress: () => void
}

type ProgressStore = ProgressState & ProgressActions

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => ({
      solvedQuestions: new Map(),
      totalPoints: 0,
      streak: { currentStreak: 0, lastActiveDate: '', longestStreak: 0 },
      lastPosition: null,
      badges: { earned: new Map() },
      settings: { theme: 'system', editorFontSize: 14 },

      markSolved: (questionId, timeMs, hintsUsed) => set((state) => {
        const newSolved = new Map(state.solvedQuestions)
        const existing = newSolved.get(questionId)
        newSolved.set(questionId, {
          timestamp: Date.now(),
          attempts: (existing?.attempts ?? 0) + 1,
          bestTimeMs: Math.min(
            timeMs,
            existing?.bestTimeMs ?? Infinity
          ),
          hintsUsed,
        })
        return { solvedQuestions: newSolved }
      }),

      addPoints: (points) => set((state) => ({
        totalPoints: state.totalPoints + points
      })),

      updateStreak: () => set((state) => {
        const today = new Date().toISOString().split('T')[0]
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .split('T')[0]

        let newStreak: number
        if (state.streak.lastActiveDate === today) {
          newStreak = state.streak.currentStreak
        } else if (state.streak.lastActiveDate === yesterday) {
          newStreak = state.streak.currentStreak + 1
        } else {
          newStreak = 1
        }

        return {
          streak: {
            currentStreak: newStreak,
            lastActiveDate: today as string,
            longestStreak: Math.max(
              newStreak,
              state.streak.longestStreak
            ),
          }
        }
      }),

      earnBadge: (badgeId) => set((state) => {
        const newEarned = new Map(state.badges.earned)
        if (!newEarned.has(badgeId)) {
          newEarned.set(badgeId, { timestamp: Date.now() })
        }
        return { badges: { earned: newEarned } }
      }),

      saveLastPosition: (topicId, questionId) => set({
        lastPosition: { topicId, questionId }
      }),

      exportProgress: () => {
        const state = get()
        return JSON.stringify({
          solvedQuestions: Array.from(state.solvedQuestions.entries()),
          totalPoints: state.totalPoints,
          streak: state.streak,
          badges: Array.from(state.badges.earned.entries()),
          lastPosition: state.lastPosition,
          exportedAt: new Date().toISOString(),
        })
      },

      importProgress: (data) => {
        const parsed: ImportProgressData = JSON.parse(data) as ImportProgressData
        set({
          solvedQuestions: new Map(parsed.solvedQuestions),
          totalPoints: parsed.totalPoints,
          streak: parsed.streak,
          badges: { earned: new Map(parsed.badges) },
          lastPosition: parsed.lastPosition,
        })
      },

      setTheme: (theme) => set((state) => ({
        settings: { ...state.settings, theme }
      })),

      setFontSize: (size) => set((state) => ({
        settings: { ...state.settings, editorFontSize: size }
      })),

      resetProgress: () => set({
        solvedQuestions: new Map(),
        totalPoints: 0,
        streak: { currentStreak: 0, lastActiveDate: '', longestStreak: 0 },
        badges: { earned: new Map() },
        lastPosition: null,
      }),
    }),
    {
      name: 'logixzen-progress',
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0) {
          const state = persistedState as Record<string, unknown>
          return { ...state, settings: { theme: 'system' as const, editorFontSize: 14 } }
        }
        return persistedState as ProgressState
      },
    }
  )
)
