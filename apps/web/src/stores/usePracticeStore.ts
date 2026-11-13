// Practice mode — question state management
import { create } from 'zustand'
import type { Question } from '@logixzen/shared/content'

export interface PracticeState {
  // Current question
  currentQuestion: Question | null
  currentTopicId: string
  currentIndex: number
  questions: Question[]

  // Submission state
  answer: string
  isRunning: boolean
  isSubmitted: boolean
  gradeResult: GradeResult | null

  // Hints and solution
  hintsRevealed: number
  showSolution: boolean

  // Progress tracking (from localStorage via Phase 7)
  solvedIds: Set<string>
}

export interface GradeResult {
  passed: boolean
  testCases: TestCaseResult[]
  pointsEarned: number
  totalTimeMs: number
}

export interface TestCaseResult {
  id: string
  passed: boolean
  description?: string
  error?: string
  executionTimeMs: number
}

interface PracticeActions {
  setQuestion: (question: Question, topicId: string, index: number, questions: Question[]) => void
  setAnswer: (answer: string) => void
  runQuery: () => Promise<void>
  submitAnswer: () => Promise<void>
  revealHint: () => void
  showSolutionFn: () => void
  nextQuestion: () => void
  prevQuestion: () => void
  markSolved: (id: string) => void
  reset: () => void
}

type PracticeStore = PracticeState & PracticeActions

const initialState: PracticeState = {
  currentQuestion: null,
  currentTopicId: '',
  currentIndex: 0,
  questions: [],
  answer: '',
  isRunning: false,
  isSubmitted: false,
  gradeResult: null,
  hintsRevealed: 0,
  showSolution: false,
  solvedIds: new Set(),
}

export const usePracticeStore = create<PracticeStore>()((set, get) => ({
  ...initialState,

  setQuestion: (question, topicId, index, questions) => {
    set({
      currentQuestion: question,
      currentTopicId: topicId,
      currentIndex: index,
      questions,
      answer: '',
      isRunning: false,
      isSubmitted: false,
      gradeResult: null,
      hintsRevealed: 0,
      showSolution: false,
    })
  },

  setAnswer: (answer) => set({ answer, isSubmitted: false, gradeResult: null }),

  runQuery: async () => {
    set({ isRunning: true })
    // Preview query result — will be implemented with WebSqlEngine in playground
    await new Promise((resolve) => setTimeout(resolve, 300))
    set({ isRunning: false })
  },      submitAnswer: async () => {
    const { currentQuestion } = get()
    if (!currentQuestion) return

    set({ isRunning: true, isSubmitted: true })

    try {
      set({ isRunning: false })
    } catch {
      set({ isRunning: false })
    }
  },

  revealHint: () => {
    const { hintsRevealed, currentQuestion } = get()
    if (!currentQuestion || hintsRevealed >= currentQuestion.hints.length) return

    set({ hintsRevealed: hintsRevealed + 1 })
  },

  showSolutionFn: () => set({ showSolution: true }),

  nextQuestion: () => {
    const { currentIndex, questions } = get()
    if (currentIndex < questions.length - 1) {
      // Handled by component which sets the next question
    }
  },

  prevQuestion: () => {
    const { currentIndex } = get()
    if (currentIndex > 0) {
      // Handled by component which sets the previous question
    }
  },

  markSolved: (id) => {
    const { solvedIds } = get()
    const newSet = new Set(solvedIds)
    newSet.add(id)
    set({ solvedIds: newSet })
  },

  reset: () => set(initialState),
}))
