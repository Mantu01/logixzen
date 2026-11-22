"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  FlaskConical,
  Lightbulb,
  Loader2,
  Play,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { Question } from "@logixzen/shared/content";
import type { SqlResult } from "@/shared/desktop-api";
import { PageShell } from "@/components/app-shell/page-shell";
import { SqlCodeEditor } from "@/components/editor/SqlCodeEditor";
import { PlaygroundResultPanel } from "@/components/playground/ResultPanel";
import { AiActionButtons } from "@/components/learn/AiActionButtons";
import { Badge } from "@/features/learn/Badge";
import {
  useGrading,
  type GradeResult,
} from "@/features/learn/hooks/useGrading";
import { BADGE_DEFINITIONS } from "@/features/badges/badgeDefinitions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { useSqlStore } from "@/sql/useSqlStore";
import { dialectLabel, tableMapFrom } from "@/lib/sql-editor";
import { cn } from "@/lib/utils";

interface QuestionDetailProps {
  topicId: string;
  questionId: string;
  categoryId?: string;
}

export function QuestionDetailContent({
  topicId,
  questionId,
  categoryId,
}: QuestionDetailProps): React.ReactElement {
  const questions = usePackStore((state) => state.questions);
  const hydrated = usePackStore((state) => state.hydrated);

  const question = useMemo<Question | null>(
    () =>
      questions.find(
        (item) => item.id === questionId && (item.topicId === topicId || topicId === ""),
      ) ?? null,
    [questions, questionId, topicId],
  );

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center text-muted-dim">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  if (question === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[13px] text-muted">Question not found</p>
        <Link href={categoryId ? `/learn/category?id=${categoryId}` : `/learn/topic?id=${topicId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="size-3.5" /> Back to list
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <QuestionWorkspace
      key={question.id}
      question={question}
      topicId={topicId || question.topicId}
      categoryId={categoryId}
    />
  );
}

function QuestionWorkspace({
  question,
  topicId,
  categoryId,
}: {
  question: Question;
  topicId: string;
  categoryId?: string;
}): React.ReactElement {
  const router = useRouter();
  const questions = usePackStore((state) => state.questions);
  const categories = usePackStore((state) => state.categories);
  const assignments = usePackStore((state) => state.questionCategory);
  const solvedMap = useProgressStore((state) => state.solvedQuestions);
  const schema = useSqlStore((state) => state.schema);
  const dialect = useSqlStore((state) => state.activeDialect);
  const editorFontSize = useProgressStore(
    (state) => state.settings.editorFontSize,
  );

  const activeCategoryId = categoryId ?? assignments[question.id];
  const activeCategory = categories.find((c) => c.id === activeCategoryId);
  const activeCategoryName = activeCategory?.name ?? "Categories";

  const topicQuestions = useMemo(
    () => questions.filter((item) => item.topicId === topicId),
    [questions, topicId],
  );

  const tableMap = useMemo(() => tableMapFrom(schema), [schema]);

  const index = topicQuestions.findIndex((item) => item.id === question.id);
  const { grade, isGrading, runAnswer } = useGrading(question);

  const [answer, setAnswer] = useState("");
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [runResults, setRunResults] = useState<SqlResult[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [aiOutput, setAiOutput] = useState<string | null>(null);

  useEffect(() => {
    saveProgressPosition(topicId, question.id);
  }, [topicId, question.id]);

  const alreadySolved = solvedMap.has(question.id);

  const run = useCallback(async (): Promise<void> => {
    if (answer.trim().length === 0) return;
    const results = await runAnswer(answer);
    setRunResults(results);
    setShowResult(true);
    setGradeResult(null);
  }, [answer, runAnswer]);

  const submit = useCallback(async (): Promise<void> => {
    if (answer.trim().length === 0) return;
    const result = await grade(answer);
    setGradeResult(result);
    setShowResult(false);
    if (!result.passed) return;

    const progress = useProgressStore.getState();
    const firstSolve = !progress.solvedQuestions.has(question.id);
    progress.markSolved(question.id, result.totalTimeMs, hintsRevealed);
    if (firstSolve) {
      progress.addPoints(result.pointsEarned);
    }
    const streak = progress.updateStreak();
    progress.recordActivity(0);

    const updated = useProgressStore.getState();
    const unlocked = BADGE_DEFINITIONS.filter(
      (badge) =>
        !updated.badges.earned.has(badge.id) &&
        badge.condition({
          solvedQuestions: updated.solvedQuestions.size,
          streak: { currentStreak: streak },
          totalPoints: updated.totalPoints,
        }),
    );
    unlocked.forEach((badge) => progress.earnBadge(badge.id));

    if (window.logixzen !== undefined && firstSolve) {
      if (unlocked[0] !== undefined) {
        void window.logixzen.notifications.badge(
          "Badge unlocked",
          unlocked[0].title,
        );
      } else if (updated.solvedQuestions.size === 1) {
        void window.logixzen.notifications.badge(
          "First solve",
          "Welcome to LogixZen",
        );
      }
      if (streak >= 3) {
        void window.logixzen.notifications.streak(streak);
      }
    }
  }, [question, answer, grade, hintsRevealed]);

  const navigate = useCallback(
    (offset: number) => {
      const target = topicQuestions[index + offset];
      if (target === undefined) return;
      router.push(`/learn/practice?topic=${topicId}&q=${target.id}`);
    },
    [router, topicQuestions, index, topicId],
  );

  const isSqlQuestion =
    question.type === "query" ||
    question.type === "debug-query" ||
    question.type === "predict-output" ||
    question.type === "dml-check";

  return (
    <PageShell
      title={question.title}
      subtitle={`${index + 1}/${topicQuestions.length} · ${question.points} pts · ${question.datasetId}`}
      actions={
        <>
          <Link
            href="/databases"
            title={`Active SQL dialect: ${dialectLabel(dialect)}. Switch in Databases`}
            className="flex h-7 items-center gap-1.5 border border-border bg-surface px-2.5 text-[11px] text-muted transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <span className="size-1.5 bg-primary" />
            <span className="font-mono font-medium uppercase text-foreground">
              {dialectLabel(dialect)}
            </span>
          </Link>
          {alreadySolved ? (
            <span className="flex items-center gap-1 bg-success/10 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-success">
              <CheckCircle2 className="size-3" /> Solved
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => void run()}
            disabled={isGrading || answer.trim().length === 0 || !isSqlQuestion}
          >
            {isGrading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}{" "}
            Run
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => void submit()}
            disabled={isGrading || answer.trim().length === 0}
          >
            {isGrading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FlaskConical className="size-3.5" />
            )}{" "}
            Submit
          </Button>
        </>
      }
    >
      <div className="mx-auto max-w-4xl space-y-5 px-5 py-5">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-dim">
          <Link href="/" className="hover:text-foreground">
            Workspace
          </Link>
          <span>/</span>
          <Link href="/learn" className="hover:text-foreground">
            Categories
          </Link>
          <span>/</span>
          <Link
            href={
              activeCategoryId
                ? `/learn/category?id=${activeCategoryId}`
                : `/learn/topic?id=${topicId}`
            }
            className="hover:text-foreground"
          >
            {activeCategoryName}
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">{question.title}</span>
        </div>
        <section className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                question.difficulty === "easy"
                  ? "success"
                  : question.difficulty === "medium"
                    ? "warning"
                    : "error"
              }
            >
              {question.difficulty}
            </Badge>
            <span className="text-[10.5px] text-muted-dim">
              {question.tags.join(" · ")}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
            {question.description}
          </p>
          {question.type === "debug-query" ? (
            <pre className="border border-error/30 bg-error/5 p-3 font-mono text-[12px] text-foreground">
              {question.brokenQuery}
            </pre>
          ) : null}
          {question.type === "dml-check" ? (
            <div className="border border-border bg-surface-alt p-3">
              <div className="section-label mb-1">Statement to write</div>
              <pre className="font-mono text-[12px]">
                {question.dmlStatement}
              </pre>
              <p className="mt-1 text-[11px] text-muted-dim">
                Expected rows affected:{" "}
                <span className="numeric text-foreground">
                  {question.expectedChanges}
                </span>
              </p>
            </div>
          ) : null}
          {question.type === "predict-output" &&
          question.expectedOutput.length > 0 ? (
            <div className="border border-border bg-surface-alt p-3">
              <div className="section-label mb-1">Expected shape</div>
              <p className="font-mono text-[11.5px] text-muted-dim">
                {Object.keys(question.expectedOutput[0]).join(" · ")} —{" "}
                {question.expectedOutput.length} rows
              </p>
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="section-label">
                {isSqlQuestion ? "Your query" : "Your answer"}
              </span>
              {isSqlQuestion ? (
                <span
                  title={`${dialectLabel(dialect)} syntax`}
                  className="border border-border px-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-dim"
                >
                  {dialectLabel(dialect)}
                </span>
              ) : null}
            </span>
            <AiActionButtons
              question={question}
              studentAnswer={answer}
              hintsRevealed={hintsRevealed}
              errorMessage={
                gradeResult !== null && !gradeResult.passed
                  ? (gradeResult.testCases.find((testCase) => !testCase.passed)
                      ?.message ?? "Query failed")
                  : null
              }
              onHint={setAiOutput}
              onExplainError={setAiOutput}
              onExplainQuery={setAiOutput}
            />
          </div>
          {isSqlQuestion ? (
            <div className="h-64 border border-border bg-editor">
              <SqlCodeEditor
                value={answer}
                onChange={setAnswer}
                onRun={() => void run()}
                onSubmit={() => void submit()}
                fontSize={editorFontSize}
                dialect={dialect}
                tables={tableMap}
                placeholder="Write your statement…"
                minHeight="100%"
              />
            </div>
          ) : (
            <AnswerInputs
              question={question}
              answer={answer}
              onChange={setAnswer}
            />
          )}
        </section>

        {aiOutput !== null ? (
          <section className="border border-primary/40 bg-primary/5 p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary" />
              <span className="section-label">AI assistant</span>
              <Button
                variant="ghost"
                size="xs"
                className="ml-auto"
                onClick={() => setAiOutput(null)}
              >
                Dismiss
              </Button>
            </div>
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-muted">
              {aiOutput}
            </p>
          </section>
        ) : null}

        {runResults.length > 0 && showResult ? (
          <section className="h-80 border border-border">
            <PlaygroundResultPanel
              result={runResults[runResults.length - 1] ?? null}
              onCopy={() => undefined}
              onExportCsv={() => undefined}
              onExportJson={() => undefined}
            />
          </section>
        ) : null}

        {gradeResult !== null ? (
          <GradeReport result={gradeResult} points={question.points} />
        ) : null}

        <HintPanel
          hints={question.hints}
          revealed={hintsRevealed}
          onReveal={() => setHintsRevealed((value) => value + 1)}
        />

        {gradeResult?.passed === true || showSolution ? (
          <SolutionPanel
            question={question}
            open={showSolution}
            onOpen={() => setShowSolution(true)}
          />
        ) : null}

        <div className="flex items-center justify-between border-t border-border pb-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate(-1)}
            disabled={index <= 0}
          >
            <ArrowLeft className="size-3.5" /> Previous
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => navigate(1)}
            disabled={index >= topicQuestions.length - 1}
          >
            Next <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

function saveProgressPosition(topicId: string, questionId: string): void {
  useProgressStore.getState().saveLastPosition(topicId, questionId);
}

function AnswerInputs({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: string;
  onChange: (value: string) => void;
}): React.ReactElement {
  if (question.type === "mcq-single" || question.type === "mcq-multi") {
    const multiple = question.type === "mcq-multi";
    const selected = new Set(answer.split(",").filter(Boolean));
    return (
      <div className="space-y-1.5">
        {multiple ? (
          question.options.map((option) => {
            const checked = selected.has(option.id);
            return (
              <Label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 border p-3 text-[12.5px] transition-colors",
                  checked
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:bg-surface-hover",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => {
                    if (checked) selected.delete(option.id);
                    else selected.add(option.id);
                    onChange(Array.from(selected).join(","));
                  }}
                  className="mt-0.5"
                />
                <span className="font-mono">{option.text}</span>
              </Label>
            );
          })
        ) : (
          <RadioGroup value={answer} onValueChange={onChange}>
            {question.options.map((option) => (
              <Label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 border p-3 text-[12.5px] transition-colors",
                  answer === option.id
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:bg-surface-hover",
                )}
              >
                <RadioGroupItem value={option.id} className="mt-0.5" />
                <span className="font-mono">{option.text}</span>
              </Label>
            ))}
          </RadioGroup>
        )}
      </div>
    );
  }

  if (question.type === "fill-blank") {
    const positions = Object.keys(question.acceptedAnswers)
      .map(Number)
      .sort((a, b) => a - b);
    const parts = question.blankTemplate.split(/_{3,}/);
    const values = answer === "" ? positions.map(() => "") : answer.split("|");
    return (
      <div className="flex flex-wrap items-center gap-2 border border-border bg-editor p-3 font-mono text-[12.5px]">
        {parts.map((part, partIndex) => (
          <span key={partIndex} className="contents">
            {partIndex > 0 ? (
              <Input
                value={values[partIndex - 1] ?? ""}
                onChange={(event) => {
                  const next = positions.map((_, position) =>
                    position === partIndex - 1
                      ? event.target.value
                      : (values[position] ?? ""),
                  );
                  onChange(next.join("|"));
                }}
                className="h-7 w-40 font-mono text-[12px]"
                aria-label={`Blank ${partIndex}`}
              />
            ) : null}
            <span className="whitespace-pre-wrap text-muted">{part}</span>
          </span>
        ))}
      </div>
    );
  }

  return <div />;
}

function GradeReport({
  result,
  points,
}: {
  result: GradeResult;
  points: number;
}): React.ReactElement {
  const visible = result.testCases.filter(
    (testCase) => !testCase.hidden || testCase.passed,
  );
  return (
    <section
      className={cn(
        "border",
        result.passed
          ? "border-success/40 bg-success/5"
          : "border-error/40 bg-error/5",
      )}
    >
      <div className="flex items-center gap-2 border-b border-inherit px-3 py-2">
        {result.passed ? (
          <CheckCircle2 className="size-4 text-success" />
        ) : (
          <XCircle className="size-4 text-error" />
        )}
        <span
          className={cn(
            "text-[12.5px] font-semibold",
            result.passed ? "text-success" : "text-error",
          )}
        >
          {result.passed
            ? `All ${visible.length} test cases passed`
            : "Test cases failed"}
        </span>
        <span className="numeric ml-auto text-[10.5px] text-muted-dim">
          {result.totalTimeMs.toFixed(0)}ms · {points} pts
        </span>
      </div>
      <div className="divide-y divide-border/60">
        {visible.map((testCase) => (
          <div key={testCase.id} className="flex items-start gap-2.5 px-3 py-2">
            {testCase.passed ? (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
            ) : (
              <XCircle className="mt-0.5 size-3.5 shrink-0 text-error" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium">{testCase.label}</div>
              {testCase.message ? (
                <div className="mt-0.5 font-mono text-[11px] text-error/90">
                  {testCase.message}
                </div>
              ) : null}
            </div>
            <span className="numeric shrink-0 text-[10px] text-muted-dim">
              {testCase.passed ? "pass" : "fail"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function HintPanel({
  hints,
  revealed,
  onReveal,
}: {
  hints: string[];
  revealed: number;
  onReveal: () => void;
}): React.ReactElement | null {
  if (hints.length === 0) return null;
  return (
    <section className="border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Lightbulb className="size-3.5 text-warning" />
        <span className="section-label">Hints</span>
        <span className="numeric text-[10px] text-muted-dim">
          {revealed}/{hints.length}
        </span>
        {revealed < hints.length ? (
          <Button
            variant="ghost"
            size="xs"
            className="ml-auto"
            onClick={onReveal}
          >
            Reveal hint {revealed + 1}
          </Button>
        ) : null}
      </div>
      {revealed > 0 ? (
        <div className="divide-y divide-border/60">
          {hints.slice(0, revealed).map((hint, hintIndex) => (
            <p
              key={hintIndex}
              className="border-l-2 border-warning/60 bg-surface-alt/50 px-3 py-2 text-[12px] text-muted"
            >
              {hint}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SolutionPanel({
  question,
  open,
  onOpen,
}: {
  question: Question;
  open: boolean;
  onOpen: () => void;
}): React.ReactElement {
  const solution = "solutionSql" in question ? question.solutionSql : "";
  return (
    <section className="border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Eye className="size-3.5 text-info" />
        <span className="section-label">Solution</span>
        {!open ? (
          <Button
            variant="ghost"
            size="xs"
            className="ml-auto"
            onClick={onOpen}
          >
            Show solution
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="space-y-2 p-3">
          {solution !== "" ? (
            <pre className="overflow-x-auto border border-border bg-editor p-3 font-mono text-[12px] text-foreground">
              {solution}
            </pre>
          ) : null}
          <p className="text-[12px] leading-relaxed text-muted">
            {question.explanation}
          </p>
        </div>
      ) : null}
    </section>
  );
}
