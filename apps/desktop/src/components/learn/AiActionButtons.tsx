"use client";

import { useCallback, useState } from "react";
import { FileText, Lightbulb, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAiStore } from "@/stores/useAiStore";
import type { Question } from "@logixzen/shared/content";

interface AiActionButtonsProps {
  question: Question
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
}: AiActionButtonsProps): React.ReactElement | null {
  const apiKey = useAiStore((state) => state.apiKey)
  const generateHint = useAiStore((state) => state.generateHint)
  const explainError = useAiStore((state) => state.explainError)
  const explainQuery = useAiStore((state) => state.explainQuery)
  const [loading, setLoading] = useState<string | null>(null)

  const privacy = { sendSchemaOnly: true, sendHistory: false, sendProgress: false }

  const run = useCallback(
    async (kind: "hint" | "error" | "query", action: () => Promise<string>, done: (text: string) => void) => {
      setLoading(kind)
      try {
        done(await action())
      } finally {
        setLoading(null)
      }
    },
    [],
  )

  if (!apiKey) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 flex items-center gap-1 text-[10.5px] text-muted-dim">
        <Sparkles className="size-3" /> AI
      </span>
      <Button
        variant="outline"
        size="xs"
        disabled={loading !== null}
        onClick={() =>
          void run(
            "hint",
            () =>
              generateHint({
                question,
                currentHintIndex: question.hints.length,
                studentAttemptCount: 0,
                privacySettings: privacy,
              }),
            onHint,
          )
        }
      >
        {loading === "hint" ? <Loader2 className="size-3 animate-spin" /> : <Lightbulb className="size-3" />}
        Hint
      </Button>
      {errorMessage !== null ? (
        <Button
          variant="outline"
          size="xs"
          disabled={loading !== null}
          onClick={() =>
            void run(
              "error",
              () =>
                explainError({
                  question,
                  sql: studentAnswer,
                  errorMessage,
                  privacySettings: privacy,
                }),
              onExplainError,
            )
          }
        >
          {loading === "error" ? <Loader2 className="size-3 animate-spin" /> : <MessageSquare className="size-3" />}
          Explain error
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="xs"
        disabled={loading !== null || studentAnswer.trim().length === 0}
        onClick={() =>
          void run(
            "query",
            () =>
              explainQuery({
                question,
                sql: studentAnswer,
                result: null,
                privacySettings: privacy,
              }),
            onExplainQuery,
          )
        }
      >
        {loading === "query" ? <Loader2 className="size-3 animate-spin" /> : <FileText className="size-3" />}
        Explain query
      </Button>
    </div>
  )
}
