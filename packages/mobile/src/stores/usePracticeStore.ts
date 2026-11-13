import { create } from 'zustand'
import { gradeQuestion, setCurrentStudentSql } from '@logixzen/shared/practice/grader'
import type { Question, Dataset } from '@logixzen/shared/content'
import type { GradeResult } from '@logixzen/shared/practice/grader'
import type { SqlResult } from '@logixzen/shared/sql-engine'
import { useProgressStore } from './useProgressStore'

interface PracticeState {
  currentQuestion: Question | null
  currentTopicId: string | null
  studentAnswer: string
  isRunning: boolean
  isSubmitted: boolean
  gradeResult: GradeResult | null
  hintsRevealed: number
  selectedOptions: string[]
  attemptCount: number
  showExplanation: boolean
}

interface PracticeActions {
  setQuestion: (q: Question) => void
  setTopicId: (id: string) => void
  setAnswer: (answer: string) => void
  submitAnswer: (dataset: Dataset, executeSql: (sql: string) => Promise<SqlResult[]>) => Promise<void>
  revealHint: () => void
  selectOption: (optionId: string) => void
  toggleOption: (optionId: string) => void
  resetQuestion: () => void
  showSolution: () => void
  canGoBack: boolean
  canGoNext: boolean
  nextQuestion: () => void
  prevQuestion: () => void
}

export const usePracticeStore = create<PracticeState & PracticeActions>((set, get) => ({
  currentQuestion: null,
  currentTopicId: null,
  studentAnswer: '',
  isRunning: false,
  isSubmitted: false,
  gradeResult: null,
  hintsRevealed: 0,
  selectedOptions: [],
  attemptCount: 0,
  showExplanation: false,

  setQuestion: (q) =>
    set({
      currentQuestion: q,
      studentAnswer: '',
      isSubmitted: false,
      gradeResult: null,
      hintsRevealed: 0,
      selectedOptions: [],
      attemptCount: 0,
      showExplanation: false,
    }),

  setTopicId: (currentTopicId) => set({ currentTopicId }),

  setAnswer: (studentAnswer) => set({ studentAnswer }),

  submitAnswer: async (dataset, executeSql) => {
    const { currentQuestion, studentAnswer, hintsRevealed, attemptCount } = get()
    if (currentQuestion === null || studentAnswer.trim().length === 0) return

    setCurrentStudentSql(studentAnswer)
    set({ isRunning: true })

    try {
      const result = await gradeQuestion(studentAnswer, currentQuestion, dataset, { execute: executeSql })
      const newAttempts = attemptCount + 1

      const passed = result.passed
      if (passed) {
        const progressActions = useProgressStore.getState().actions
        progressActions.markSolved(currentQuestion.id)
        const penalty = hintsRevealed * (currentQuestion.points * 0.1)
        progressActions.addPoints(Math.max(1, Math.round(currentQuestion.points - penalty)))
      }

      set({
        gradeResult: result,
        isSubmitted: true,
        isRunning: false,
        attemptCount: newAttempts,
        showExplanation: true,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({
        gradeResult: {
          passed: false,
          score: 0,
          feedback: message,
          testResults: [],
          hintsUsed: hintsRevealed,
        },
        isSubmitted: true,
        isRunning: false,
        showExplanation: true,
      })
    }
  },

  revealHint: () => {
    const { currentQuestion, hintsRevealed } = get()
    if (currentQuestion !== null && hintsRevealed < currentQuestion.hints.length) {
      set({ hintsRevealed: hintsRevealed + 1 })
    }
  },

  selectOption: (optionId) => {
    const { selectedOptions } = get()
    set({ selectedOptions: [optionId] })
  },

  toggleOption: (optionId) => {
    const { selectedOptions } = get()
    const next = selectedOptions.includes(optionId)
      ? selectedOptions.filter((id) => id !== optionId)
      : [...selectedOptions, optionId]
    set({ selectedOptions: next })
  },

  resetQuestion: () => {
    const { currentQuestion } = get()
    if (currentQuestion !== null) {
      set({
        studentAnswer: '',
        isSubmitted: false,
        gradeResult: null,
        hintsRevealed: 0,
        selectedOptions: [],
        attemptCount: 0,
        showExplanation: false,
      })
    }
  },

  showSolution: () => {
    set({ showExplanation: true })
  },

  get canGoBack() {
    return get().currentTopicId !== null
  },

  get canGoNext() {
    return get().gradeResult?.passed ?? false
  },

  nextQuestion: () => {
    set({ studentAnswer: '', isSubmitted: false, gradeResult: null, hintsRevealed: 0, selectedOptions: [], showExplanation: false })
  },

  prevQuestion: () => {
    set({ studentAnswer: '', isSubmitted: false, gradeResult: null, hintsRevealed: 0, selectedOptions: [], showExplanation: false })
  },
}))
