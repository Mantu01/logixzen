import { GradeResult, gradeQuestion, checkTechniques, detectTechnique } from './grader'
import type { Question, Dataset } from '@logixzen/shared/content'

export interface PracticeState {
  currentQuestion: Question | null
  currentTopicId: string | null
  studentAnswer: string
  isRunning: boolean
  isSubmitted: boolean
  gradeResult: GradeResult | null
  hintsRevealed: number
  selectedOptions: Set<string>
  attemptCount: number
}

export interface PracticeActions {
  setQuestion: (q: Question) => void
  setTopicId: (id: string) => void
  setAnswer: (answer: string) => void
  submitAnswer: (dataset: Dataset) => Promise<void>
  revealHint: () => void
  selectOption: (optionId: string) => void
  toggleOption: (optionId: string) => void
  resetQuestion: () => void
  canGoBack: boolean
  canGoNext: boolean
  nextQuestion: () => void
  prevQuestion: () => void
}
