import { create } from 'zustand'
import type { Question } from '@logixzen/shared/content'

interface QuestionStoreState {
  currentQuestion: Question | null
  isLoading: boolean
  error: string | null
  setCurrentQuestion: (q: Question) => void
  setLoading: (loading: boolean) => void
  setError: (error: string) => void
}

export const useQuestionStore = create<QuestionStoreState>((set) => ({
  currentQuestion: null,
  isLoading: false,
  error: null,

  setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}))
