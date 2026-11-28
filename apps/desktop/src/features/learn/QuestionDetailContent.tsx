"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FlaskConical,
  Lightbulb,
  Loader2,
  Play,
  Sparkles,
  XCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  Group,
  Panel,
  Separator,
  usePanelRef,
  type PanelSize,
} from "react-resizable-panels";
import type { Question } from "@logixzen/shared/content";
import type { SqlResult } from "@/shared/desktop-api";
import { dialectLabel } from "@/shared/dialect-sql";
import { PageShell } from "@/components/app-shell/page-shell";
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
import { tableMapFrom } from "@/lib/sql-editor";
import { cn } from "@/lib/utils";

const SqlCodeEditor = dynamic(
  () =>
    import("@/components/editor/SqlCodeEditor").then((m) => m.SqlCodeEditor),
  { ssr: false },
);

interface QuestionDetailProps {
  topicId: string;
  questionId: string;
  categoryId?: string;
}

type DrawerTab = "output" | "tests";

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
        (item) =>
          item.id === questionId &&
          (item.topicId === topicId || topicId === ""),
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
        <Button asChild variant="outline" size="sm">
          <Link
            href={
              categoryId
                ? `/learn/category?id=${categoryId}`
                : `/learn/topic?id=${topicId}`
            }
          >
            <ArrowLeft data-icon="inline-start" />
            Back to list
          </Link>
        </Button>
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
  const activeEngineName = useSqlStore((state) => state.activeEngineName);
  const editorFontSize = useProgressStore(
    (state) => state.settings.editorFontSize,
  );
  const resultFontSize = useProgressStore(
    (state) => state.settings.resultFontSize,
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
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("output");
  const [drawerCollapsed, setDrawerCollapsed] = useState(true);
  const drawerCollapsedRef = useRef(true);
  const drawerRef = usePanelRef();
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [aiOutput, setAiOutput] = useState<string | null>(null);

  useEffect(() => {
    saveProgressPosition(topicId, question.id);
  }, [topicId, question.id]);

  const alreadySolved = solvedMap.has(question.id);

  const expandDrawer = useCallback((): void => {
    const panel = drawerRef.current;
    if (panel?.isCollapsed()) panel.expand();
    drawerCollapsedRef.current = false;
    setDrawerCollapsed(false);
  }, [drawerRef]);

  const toggleDrawer = useCallback((): void => {
    const panel = drawerRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      drawerCollapsedRef.current = false;
      setDrawerCollapsed(false);
    } else {
      panel.collapse();
      drawerCollapsedRef.current = true;
      setDrawerCollapsed(true);
    }
  }, [drawerRef]);

  const run = useCallback(async (): Promise<void> => {
    if (answer.trim().length === 0) return;
    expandDrawer();
    setDrawerTab("output");
    const results = await runAnswer(answer);
    setRunResults(results);
  }, [answer, runAnswer, expandDrawer]);

  const submit = useCallback(async (): Promise<void> => {
    if (answer.trim().length === 0) return;
    expandDrawer();
    setDrawerTab("tests");
    const result = await grade(answer);
    setGradeResult(result);
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
  }, [question, answer, grade, hintsRevealed, expandDrawer]);

  const navigate = useCallback(
    (offset: number) => {
      const target = topicQuestions[index + offset];
      if (target === undefined) return;
      const catParam = categoryId ? `&category=${categoryId}` : "";
      router.push(
        `/learn/practice?topic=${topicId}&q=${target.id}${catParam}`,
      );
    },
    [router, topicQuestions, index, topicId, categoryId],
  );

  const isSqlQuestion =
    question.type === "query" ||
    question.type === "debug-query" ||
    question.type === "predict-output" ||
    question.type === "dml-check";

  const lastRun = runResults[runResults.length - 1] ?? null;

  return (
    <PageShell
      title={question.title}
      subtitle={`${index + 1}/${topicQuestions.length} · ${question.points} pts · db:${question.datasetId}`}
      showBack
      breadcrumbs={[
        { label: "Practice", href: "/learn" },
        activeCategoryId
          ? {
              label: activeCategoryName,
              href: `/learn/category?id=${activeCategoryId}`,
            }
          : {
              label: topicId.replace(/[-_]+/g, " "),
              href: `/learn/topic?id=${topicId}`,
            },
        { label: question.title },
      ]}
      actions={
        <div className="flex items-center gap-1.5">
          <Link
            href="/databases"
            className="flex h-7 items-center gap-1.5 border border-border bg-surface-alt px-2.5 text-[10.5px] text-muted transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <span className="size-1.5 bg-primary" />
            <span className="font-mono font-semibold uppercase text-foreground">
              {dialectLabel(dialect)}
            </span>
          </Link>
          {alreadySolved ? (
            <span className="flex h-7 items-center gap-1 border border-success/40 bg-success/10 px-2 text-[10px] font-medium uppercase tracking-wider text-success">
              <CheckCircle2 className="size-3" /> Solved
            </span>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-border text-[11px]"
            onClick={() => navigate(-1)}
            disabled={index <= 0}
          >
            <ArrowLeft data-icon="inline-start" />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-border text-[11px]"
            onClick={() => navigate(1)}
            disabled={index >= topicQuestions.length - 1}
          >
            Next
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      }
      bodyClassName="overflow-hidden"
    >
      <Group orientation="horizontal" id="practice-split" className="h-full min-h-0">
        <Panel id="prompt" defaultSize="42%" minSize="26%" maxSize="60%">
          <div className="flex h-full min-h-0 flex-col bg-surface">
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
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
                  <span className="numeric border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[10px] text-muted">
                    {question.points} pts
                  </span>
                  <span className="text-[10.5px] text-muted-dim">
                    {question.tags.join(" · ")}
                  </span>
                </div>

                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
                  {question.description}
                </p>

                {question.type === "debug-query" ? (
                  <div className="border border-error/30 bg-error/5 p-3">
                    <div className="section-label mb-1 text-error">
                      Query to fix
                    </div>
                    <pre className="overflow-x-auto font-mono text-[12px] text-foreground">
                      {question.brokenQuery}
                    </pre>
                  </div>
                ) : null}

                {question.type === "dml-check" ? (
                  <div className="border border-border bg-surface-alt p-3">
                    <div className="section-label mb-1">Statement to verify</div>
                    <pre className="overflow-x-auto font-mono text-[12px]">
                      {question.dmlStatement}
                    </pre>
                    <p className="mt-1.5 text-[11px] text-muted-dim">
                      Expected rows affected:{" "}
                      <span className="numeric font-mono text-foreground">
                        {question.expectedChanges}
                      </span>
                    </p>
                  </div>
                ) : null}

                {question.type === "predict-output" &&
                question.expectedOutput.length > 0 ? (
                  <div className="border border-border bg-surface-alt p-3">
                    <div className="section-label mb-1">Expected shape</div>
                    <p className="font-mono text-[11.5px] text-muted">
                      {Object.keys(question.expectedOutput[0]).join(" · ")} —{" "}
                      {question.expectedOutput.length} rows
                    </p>
                  </div>
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
              </div>
            </div>
          </div>
        </Panel>

        <Separator className="w-px bg-border transition-colors hover:bg-primary/60" />

        <Panel id="workspace" defaultSize="58%" minSize="38%">
          <Group orientation="vertical" id="practice-workspace-vertical">
            <Panel id="answer" minSize="25%">
              <div className="flex h-full min-h-0 flex-col bg-background">
                <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3">
                  <div className="flex items-center gap-2">
                    <span className="section-label">
                      {isSqlQuestion ? "Query editor" : "Answer"}
                    </span>
                    {isSqlQuestion ? (
                      <span className="border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-primary">
                        {dialectLabel(dialect)} · {activeEngineName}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AiActionButtons
                      question={question}
                      studentAnswer={answer}
                      hintsRevealed={hintsRevealed}
                      errorMessage={
                        gradeResult !== null && !gradeResult.passed
                          ? (gradeResult.testCases.find(
                              (testCase) => !testCase.passed,
                            )?.message ?? "Query failed")
                          : null
                      }
                      onHint={setAiOutput}
                      onExplainError={setAiOutput}
                      onExplainQuery={setAiOutput}
                    />
                    {isSqlQuestion ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 border-border text-[11px]"
                        onClick={() => void run()}
                        disabled={isGrading || answer.trim().length === 0}
                      >
                        {isGrading ? (
                          <Loader2
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        ) : (
                          <Play data-icon="inline-start" />
                        )}
                        Run
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => void submit()}
                      disabled={isGrading || answer.trim().length === 0}
                    >
                      {isGrading ? (
                        <Loader2
                          data-icon="inline-start"
                          className="animate-spin"
                        />
                      ) : (
                        <FlaskConical data-icon="inline-start" />
                      )}
                      Submit
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto">
                  {isSqlQuestion ? (
                    <SqlCodeEditor
                      value={answer}
                      onChange={setAnswer}
                      onRun={() => void run()}
                      onSubmit={() => void submit()}
                      fontSize={editorFontSize}
                      dialect={dialect}
                      tables={tableMap}
                      placeholder={`Write your ${dialectLabel(dialect)} solution…`}
                      minHeight="100%"
                    />
                  ) : (
                    <div className="p-4">
                      <AnswerInputs
                        question={question}
                        answer={answer}
                        onChange={setAnswer}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            <Separator className="h-px bg-border transition-colors hover:bg-primary/60" />

            <Panel
              id="drawer"
              panelRef={drawerRef}
              defaultSize={32}
              minSize={130}
              maxSize="75%"
              collapsible
              collapsedSize={32}
              onResize={(size: PanelSize) => {
                const collapsed =
                  drawerRef.current?.isCollapsed() ?? size.inPixels <= 40;
                if (collapsed !== drawerCollapsedRef.current) {
                  drawerCollapsedRef.current = collapsed;
                  setDrawerCollapsed(collapsed);
                }
              }}
            >
              <div className="flex h-full min-h-0 flex-col bg-surface">
                <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border bg-surface px-2.5">
                  <button
                    type="button"
                    onClick={toggleDrawer}
                    aria-label={
                      drawerCollapsed ? "Expand drawer" : "Collapse drawer"
                    }
                    className="flex h-6 items-center gap-1 px-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-dim hover:text-foreground"
                  >
                    {drawerCollapsed ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                    <span>Results</span>
                  </button>

                  {isSqlQuestion ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerTab("output");
                        expandDrawer();
                      }}
                      className={cn(
                        "h-6 border px-2 text-[10.5px] transition-colors",
                        drawerTab === "output" && !drawerCollapsed
                          ? "border-primary/40 bg-accent text-accent-foreground"
                          : "border-transparent text-muted-dim hover:text-foreground",
                      )}
                    >
                      Query output
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      setDrawerTab("tests");
                      expandDrawer();
                    }}
                    className={cn(
                      "flex h-6 items-center gap-1.5 border px-2 text-[10.5px] transition-colors",
                      drawerTab === "tests" && !drawerCollapsed
                        ? "border-primary/40 bg-accent text-accent-foreground"
                        : "border-transparent text-muted-dim hover:text-foreground",
                    )}
                  >
                    <span>Test cases</span>
                    {gradeResult ? (
                      <span
                        className={cn(
                          "size-1.5",
                          gradeResult.passed ? "bg-success" : "bg-error",
                        )}
                      />
                    ) : null}
                  </button>
                </div>

                {!drawerCollapsed ? (
                  <div className="min-h-0 flex-1 overflow-auto">
                    {drawerTab === "tests" ? (
                      <div className="p-3">
                        {gradeResult ? (
                          <GradeReport
                            result={gradeResult}
                            points={question.points}
                          />
                        ) : (
                          <p className="py-6 text-center text-[12px] text-muted-dim">
                            Click Submit to validate against test cases.
                          </p>
                        )}
                      </div>
                    ) : (
                      <PlaygroundResultPanel
                        result={lastRun}
                        error={lastRun?.error}
                        fontSize={resultFontSize}
                        onCopy={() => undefined}
                        onExportCsv={() => undefined}
                        onExportJson={() => undefined}
                      />
                    )}
                  </div>
                ) : null}
              </div>
            </Panel>
          </Group>
        </Panel>
      </Group>
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
      <div className="flex flex-col gap-1.5">
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
        <div className="flex flex-col gap-2 p-3">
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
