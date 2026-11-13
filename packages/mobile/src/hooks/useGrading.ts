import { useCallback } from 'react'
import { usePracticeStore } from '@/stores/usePracticeStore'
import { usePlaygroundStore } from '@/stores/usePlaygroundStore'
import type { Question, Dataset } from '@logixzen/shared/content'
import type { SqlResult } from '@logixzen/shared/sql-engine'

export function useGrading() {
  const { currentQuestion, studentAnswer, isRunning, submitAnswer } = usePracticeStore()
  const { runQuery } = usePlaygroundStore()

  const isActive = currentQuestion !== null && studentAnswer.trim().length > 0

  const handleSubmit = useCallback(async () => {
    if (currentQuestion === null) return

    // Get the SQL engine from playground store
    const executeSql = async (sql: string): Promise<SqlResult[]> => {
      // Use the playground store's engine
      await runQuery()
      const { results } = usePlaygroundStore.getState()
      return results
    }

    // Create a minimal dataset with setup SQL
    const ds: Dataset = {
      id: currentQuestion.datasetId,
      name: currentQuestion.datasetId,
      description: '',
      setupSql: '',
      tables: [],
    }

    await submitAnswer(ds, executeSql)
  }, [currentQuestion, runQuery, submitAnswer])

  return {
    isRunning,
    isActive,
    handleSubmit,
  }
}
