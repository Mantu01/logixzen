import { useCallback } from 'react'
import { usePracticeStore } from '@/stores/usePracticeStore'

export function useHints() {
  const { currentQuestion, hintsRevealed, revealHint } = usePracticeStore()

  const remainingHints = currentQuestion !== null
    ? currentQuestion.hints.length - hintsRevealed
    : 0

  const getPenalty = useCallback(() => {
    if (currentQuestion === null) return 0
    return hintsRevealed * (currentQuestion.points * 0.1)
  }, [currentQuestion, hintsRevealed])

  return {
    hints: currentQuestion?.hints ?? [],
    hintsRevealed,
    remainingHints,
    revealHint,
    getPenalty,
    hasMoreHints: remainingHints > 0,
    allHintsRevealed: remainingHints === 0 && hintsRevealed > 0,
  }
}
