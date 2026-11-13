import { useState, useCallback } from 'react'
import { Lightbulb, MessageSquare, FileText, Loader2, Sparkles } from 'lucide-react'
import { useAiStore } from '@/stores/useAiStore'
import { Button } from '@/components/ui/button'
import type { Question, Dataset } from '@logixzen/shared/content'
import type { QueryExplanationRequest } from '@/features/ai/AiPrompts'

interface AiActionButtonsProps {
  question: Question
  dataset: Dataset
  studentAnswer: string
  errorMessage: string | null
  onHint: (hint: string) => void
  onExplainError: (explanation: string) => void
  onExplainQuery: (explanation: string) => void
}

export function AiActionButtons({
  question,
  studentAnswer,
  errorMessage,
  onHint,
  onExplainError,
  onExplainQuery,
}: AiActionButtonsProps): React.ReactElement {
  const { apiKey, generateHint, explainError, explainQuery } = useAiStore()
  const [isLoading, setIsLoading] = useState<string | null>(null)

  if (!apiKey) {
    return (
      <div className="p-3 rounded border border-border bg-surface text-xs font-mono text-muted flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        Add an API key in Settings to enable AI assistance
      </div>
    )
  }

  const handleHint = useCallback(async (): Promise<void> => {
    setIsLoading('hint')
    try {
      const hint = await generateHint({
        question,
        currentHintIndex: 0,
        studentAttemptCount: 0,
        privacySettings: { sendSchemaOnly: true, sendHistory: false, sendProgress: false },
      })
      onHint(hint)
    } finally {
      setIsLoading(null)
    }
  }, [generateHint, question, onHint])

  const handleExplainError = useCallback(async (): Promise<void> => {
    if (!errorMessage) return
    setIsLoading('error')
    try {
      const explanation = await explainError({
        question,
        sql: studentAnswer,
        errorMessage,
        privacySettings: { sendSchemaOnly: true, sendHistory: false, sendProgress: false },
      })
      onExplainError(explanation)
    } finally {
      setIsLoading(null)
    }
  }, [explainError, question, studentAnswer, errorMessage, onExplainError])

  const handleExplainQuery = useCallback(async (): Promise<void> => {
    if (!studentAnswer.trim()) return
    setIsLoading('query')
    try {
      const explanation = await explainQuery({
        question,
        sql: studentAnswer,
        privacySettings: { sendSchemaOnly: true, sendHistory: false, sendProgress: false },
      } as QueryExplanationRequest)
      onExplainQuery(explanation)
    } finally {
      setIsLoading(null)
    }
  }, [explainQuery, question, studentAnswer, onExplainQuery])

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void handleHint()}
        disabled={isLoading !== null}
        className="h-7 text-xs font-mono border border-border hover:bg-surface-alt"
      >
        {isLoading === 'hint' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
        AI Hint
      </Button>

      {errorMessage && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleExplainError()}
          disabled={isLoading !== null}
          className="h-7 text-xs font-mono border border-border hover:bg-surface-alt"
        >
          {isLoading === 'error' ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
          Why Error?
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => void handleExplainQuery()}
        disabled={isLoading !== null || !studentAnswer.trim()}
        className="h-7 text-xs font-mono border border-border hover:bg-surface-alt"
      >
        {isLoading === 'query' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
        Explain Query
      </Button>
    </div>
  )
}
