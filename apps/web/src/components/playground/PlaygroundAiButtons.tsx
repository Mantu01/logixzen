import { useState, useCallback } from 'react'
import { Lightbulb, FileText, Loader2, Sparkles } from 'lucide-react'
import { useAiStore } from '@/stores/useAiStore'
import { Button } from '@/components/ui/button'
import type { HintRequest, QueryExplanationRequest } from '@/features/ai/AiPrompts'

interface PlaygroundAiButtonsProps {
  currentSql: string
  onHint: (hint: string) => void
  onExplain: (explanation: string) => void
}

export function PlaygroundAiButtons({ currentSql, onHint, onExplain }: PlaygroundAiButtonsProps): React.ReactElement {
  const { apiKey } = useAiStore()
  const [isLoading, setIsLoading] = useState<string | null>(null)

  if (!apiKey) {
    return (
      <div className="p-2 rounded border border-border bg-surface text-xs font-mono text-muted flex items-center gap-2">
        <Sparkles className="w-3 h-3 text-primary" />
        Configure API key in Settings for AI assistance
      </div>
    )
  }

  const handleHint = useCallback(async (): Promise<void> => {
    setIsLoading('hint')
    try {
      const hint = await useAiStore.getState().generateHint({
        sql: currentSql,
        currentHintIndex: 0,
        studentAttemptCount: 0,
        privacySettings: { sendSchemaOnly: true, sendHistory: false, sendProgress: false },
      } as HintRequest)
      onHint(hint)
    } finally {
      setIsLoading(null)
    }
  }, [currentSql, onHint])

  const handleExplain = useCallback(async (): Promise<void> => {
    if (!currentSql.trim()) return
    setIsLoading('explain')
    try {
      const explanation = await useAiStore.getState().explainQuery({
        sql: currentSql,
        privacySettings: { sendSchemaOnly: true, sendHistory: false, sendProgress: false },
      } as QueryExplanationRequest)
      onExplain(explanation)
    } finally {
      setIsLoading(null)
    }
  }, [currentSql, onExplain])

  return (
    <div className="flex gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void handleHint()}
        disabled={isLoading !== null}
        className="h-7 text-xs font-mono border border-border hover:bg-surface-alt"
      >
        {isLoading === 'hint' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
        AI Help
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void handleExplain()}
        disabled={isLoading !== null || !currentSql.trim()}
        className="h-7 text-xs font-mono border border-border hover:bg-surface-alt"
      >
        {isLoading === 'explain' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
        Explain
      </Button>
    </div>
  )
}
