import { useState, useCallback, useEffect } from 'react'
import type { Question } from '@logixzen/shared/content'
import { aiService } from '../service'
import { useAiStore } from '../store'
import type { AiHintResult, AiErrorDiagnosis } from '../service'

interface UseAiHintOptions {
  question: Question
  studentAnswer: string
  hintIndex: number
  error?: string | null
}

export function useAiHint({ question, studentAnswer, hintIndex, error }: UseAiHintOptions) {
  const config = useAiStore(state => state.config)
  const [aiHint, setAiHint] = useState<AiHintResult | null>(null)
  const [aiDiagnosis, setAiDiagnosis] = useState<AiErrorDiagnosis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    // Auto-generate hint when AI is enabled and question/answer change
    if (!config.enabled) {
      setAiHint(null)
      setAiDiagnosis(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    aiService
      .getHint(question, studentAnswer, hintIndex)
      .then(result => {
        if (cancelled) return
        setAiHint(result)
      })
      .catch(() => {
        if (cancelled) return
        setHasError(true)
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [question.id, studentAnswer, hintIndex, config.enabled])

  useEffect(() => {
    if (!config.enabled || !error) {
      setAiDiagnosis(null)
      return
    }
    let cancelled = false
    aiService
      .diagnoseError(question, error)
      .then(result => {
        if (cancelled) return
        setAiDiagnosis(result)
      })
      .catch(() => setAiDiagnosis(null))
    return () => { cancelled = true }
  }, [question.id, error, config.enabled])

  const refreshHint = useCallback(async () => {
    if (!config.enabled) return
    setIsLoading(true)
    setHasError(false)
    try {
      const result = await aiService.getHint(question, studentAnswer, hintIndex)
      setAiHint(result)
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [question, studentAnswer, hintIndex, config.enabled])

  const refreshDiagnosis = useCallback(async () => {
    if (!config.enabled || !error) return
    try {
      const result = await aiService.diagnoseError(question, error)
      setAiDiagnosis(result)
    } catch {
      // keep existing
    }
  }, [question, error, config.enabled])

  return {
    aiHint,
    aiDiagnosis,
    isLoading,
    hasError,
    isAiEnabled: config.enabled,
    refreshHint,
    refreshDiagnosis,
  }
}
