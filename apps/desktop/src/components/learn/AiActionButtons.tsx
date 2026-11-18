"use client";

import { useCallback, useState } from "react";
import {
  FileText,
  Lightbulb,
  Loader2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAiStore } from "@/stores/useAiStore";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { useQueryHistoryStore } from "@/stores/useQueryHistoryStore";
import { tablesFromDataset } from "@/lib/dataset-from-sql";
import type { Question } from "@logixzen/shared/content";

interface AiActionButtonsProps {
  question: Question;
  studentAnswer: string;
  errorMessage: string | null;
  onHint: (hint: string) => void;
  onExplainError: (explanation: string) => void;
  onExplainQuery: (explanation: string) => void;
}

export function AiActionButtons({
  question,
  studentAnswer,
  errorMessage,
  onHint,
  onExplainError,
  onExplainQuery,
}: AiActionButtonsProps): React.ReactElement | null {
  const apiKey = useAiStore((state) => state.apiKey);
  const generateHint = useAiStore((state) => state.generateHint);
  const explainError = useAiStore((state) => state.explainError);
  const explainQuery = useAiStore((state) => state.explainQuery);
  const privacy = useAiStore((state) => state.privacySettings);
  const datasets = usePackStore((state) => state.databases);
  const history = useQueryHistoryStore((state) => state.history);
  const solvedQuestions = useProgressStore((state) => state.solvedQuestions);
  const totalPoints = useProgressStore((state) => state.totalPoints);
  const streak = useProgressStore((state) => state.streak.currentStreak);
  const [loading, setLoading] = useState<string | null>(null);

  const context = useCallback(() => {
    const dataset = datasets.find((item) => item.id === question.datasetId);
    return {
      question,
      sql: studentAnswer,
      privacySettings: privacy,
      schema:
        privacy.sendSchemaOnly && dataset
          ? tablesFromDataset(dataset)
          : undefined,
      history: privacy.sendHistory
        ? history.map((entry) => entry.query)
        : undefined,
      progress: privacy.sendProgress
        ? { solved: solvedQuestions.size, points: totalPoints, streak }
        : undefined,
    };
  }, [
    question,
    studentAnswer,
    privacy,
    datasets,
    history,
    solvedQuestions,
    totalPoints,
    streak,
  ]);

  const run = useCallback(
    async (
      kind: "hint" | "error" | "query",
      action: () => Promise<string>,
      done: (text: string) => void,
    ) => {
      setLoading(kind);
      try {
        done(await action());
      } finally {
        setLoading(null);
      }
    },
    [],
  );

  if (!apiKey) return null;

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
                ...context(),
                currentHintIndex: question.hints.length,
                studentAttemptCount: 0,
              }),
            onHint,
          )
        }
      >
        {loading === "hint" ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Lightbulb className="size-3" />
        )}
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
              () => explainError({ ...context(), errorMessage }),
              onExplainError,
            )
          }
        >
          {loading === "error" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <MessageSquare className="size-3" />
          )}
          Explain error
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="xs"
        disabled={loading !== null || studentAnswer.trim().length === 0}
        onClick={() =>
          void run("query", () => explainQuery(context()), onExplainQuery)
        }
      >
        {loading === "query" ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <FileText className="size-3" />
        )}
        Explain query
      </Button>
    </div>
  );
}
