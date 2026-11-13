import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface StreakState {
  currentStreak: number
  lastActiveDate: string | null
}

interface Badge {
  id: string
  earnedAt: string
}

interface ProgressState {
  totalPoints: number
  solvedQuestions: string[]
  questionSolutions: Record<string, { solvedAt: string; attempts: number; hintsUsed: number }>
  streak: StreakState
  badges: Badge[]
  actions: {
    markSolved: (questionId: string) => void
    addPoints: (points: number) => void
    updateStreak: () => void
    earnBadge: (badgeId: string) => void
    resetProgress: () => void
  }
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      totalPoints: 0,
      solvedQuestions: [],
      questionSolutions: {},
      streak: { currentStreak: 0, lastActiveDate: null },
      badges: [],

      actions: {
        markSolved(questionId) {
          set((state) => {
            const questions = state.solvedQuestions.includes(questionId)
              ? state.solvedQuestions
              : [...state.solvedQuestions, questionId]
            const solutions = {
              ...state.questionSolutions,
              [questionId]: {
                solvedAt: new Date().toISOString(),
                attempts: (state.questionSolutions[questionId]?.attempts ?? 0) + 1,
                hintsUsed: state.questionSolutions[questionId]?.hintsUsed ?? 0,
              },
            }
            return { solvedQuestions: questions, questionSolutions: solutions }
          })
          get().actions.addPoints(10)
          get().actions.updateStreak()
        },

        addPoints(points) {
          set((state) => ({ totalPoints: state.totalPoints + points }))
        },

        updateStreak() {
          const today = new Date().toISOString().split('T')[0]
          const { streak } = get()

          let newStreak: StreakState
          if (streak.lastActiveDate === today) {
            newStreak = streak
          } else if (
            streak.lastActiveDate === null ||
            streak.lastActiveDate === new Date(Date.now() - 86400000).toISOString().split('T')[0]
          ) {
            newStreak = { currentStreak: streak.currentStreak + 1, lastActiveDate: today }
          } else {
            newStreak = { currentStreak: 1, lastActiveDate: today }
          }

          set({ streak: newStreak })

          if (newStreak.currentStreak >= 3) {
            const hasBadge = get().badges.some((b) => b.id === 'streak-3-day')
            if (!hasBadge) {
              get().actions.earnBadge('streak-3-day')
            }
          }
        },

        earnBadge(badgeId) {
          const { badges } = get()
          if (!badges.some((b) => b.id === badgeId)) {
            set((state) => ({
              badges: [...state.badges, { id: badgeId, earnedAt: new Date().toISOString() }],
            }))
          }
        },

        resetProgress() {
          set({
            totalPoints: 0,
            solvedQuestions: [],
            questionSolutions: {},
            streak: { currentStreak: 0, lastActiveDate: null },
            badges: [],
          })
        },
      },
    }),
    {
      name: 'logixzen-progress',
      version: 2,
    }
  )
)
