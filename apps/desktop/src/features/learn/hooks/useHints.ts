import { useState, useCallback } from 'react'
import type { Question } from '@logixzen/shared/content'

export interface HintProgress {
  current: number
  total: number
  isComplete: boolean
}

export function useHints(question: Question): {
  revealHint: () => string | null
  hintsRevealed: number
  hintProgress: HintProgress
} {
  const [hintsRevealed, setHintsRevealed] = useState<number>(0)

  const revealHint = useCallback((): string | null => {
    if (hintsRevealed >= question.hints.length) return null
    const hint: string | undefined = question.hints[hintsRevealed]
    if (!hint) return null
    setHintsRevealed((prev) => prev + 1)
    return hint
  }, [hintsRevealed, question.hints])

  const hintProgress: HintProgress = {
    current: hintsRevealed,
    total: question.hints.length,
    isComplete: hintsRevealed >= question.hints.length,
  }

  return { revealHint, hintsRevealed, hintProgress }
}
