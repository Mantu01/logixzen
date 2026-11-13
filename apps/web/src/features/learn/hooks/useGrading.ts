import { useCallback, useState } from 'react'
import type { Question } from '@logixzen/shared/content'
import type { GradeResult, TestCaseResult } from '@/stores/usePracticeStore'

export function useGrading(question: Question): {
  grade: (answer: string, hintsUsed: number) => Promise<GradeResult>
  isGrading: boolean
} {
  const [isGrading, setIsGrading] = useState<boolean>(false)

  const grade = useCallback(
    async (_answer: string, _hintsUsed: number): Promise<GradeResult> => {
      setIsGrading(true)
      try {
        const testCases: TestCaseResult[] = []
        const totalTimeMs = testCases.reduce((acc, tc) => acc + tc.executionTimeMs, 0)

        return {
          passed: false,
          testCases,
          pointsEarned: 0,
          totalTimeMs,
        }
      } finally {
        setIsGrading(false)
      }
    },
    [question]
  )

  return { grade, isGrading }
}
