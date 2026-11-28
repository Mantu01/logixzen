"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Layers,
  Search,
  Sparkles,
} from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { WorkspaceSwitcher } from "@/components/learn/WorkspaceSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoriesSection } from "@/features/learn/categories";
import { DEFAULT_WORKSPACE_ID, workspaceCategories } from "@/lib/categories";
import { dialectLabel } from "@/shared/dialect-sql";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { useSqlStore } from "@/sql/useSqlStore";
import { cn } from "@/lib/utils";

type View = "categories" | "topics";

function LearnContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const workspaceParam = searchParams.get("workspace");
  const allQuestions = usePackStore((state) => state.questions);
  const allCategories = usePackStore((state) => state.categories);
  const topicsMeta = usePackStore((state) => state.topics);
  const workspaces = usePackStore((state) => state.workspaces);
  const activeWorkspaceId =
    usePackStore((state) => state.activeWorkspaceId) || DEFAULT_WORKSPACE_ID;
  const setActiveWorkspace = usePackStore((state) => state.setActiveWorkspace);
  const questionWorkspace = usePackStore((state) => state.questionWorkspace);
  const hydrated = usePackStore((state) => state.hydrated);
  const solved = useProgressStore((state) => state.solvedQuestions);
  const lastPosition = useProgressStore((state) => state.lastPosition);
  const activeDialect = useSqlStore((state) => state.activeDialect);

  useEffect(() => {
    if (!workspaceParam || !hydrated) return;
    const direct = workspaces.find((w) => w.id === workspaceParam);
    if (direct) {
      if (direct.id !== activeWorkspaceId) setActiveWorkspace(direct.id);
      return;
    }
    const active = workspaces.find((w) => w.id === activeWorkspaceId);
    if (active && active.subjectId === workspaceParam) return;
    const bySubject = workspaces.find((w) => w.subjectId === workspaceParam);
    if (bySubject) setActiveWorkspace(bySubject.id);
  }, [
    workspaceParam,
    hydrated,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
  ]);

  const activeWorkspace = useMemo(
    () =>
      workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0],
    [workspaces, activeWorkspaceId],
  );

  const questions = useMemo(
    () =>
      allQuestions.filter(
        (q) =>
          (questionWorkspace[q.id] ?? DEFAULT_WORKSPACE_ID) ===
          activeWorkspaceId,
      ),
    [allQuestions, questionWorkspace, activeWorkspaceId],
  );
  const categories = useMemo(
    () => workspaceCategories(allCategories, activeWorkspaceId),
    [allCategories, activeWorkspaceId],
  );

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unsolved">("all");
  const [choice, setChoice] = useState<View | null>(null);
  const view: View =
    choice ?? (categories.length > 0 ? "categories" : "topics");

  const topics = useMemo(() => {
    const map = new Map<
      string,
      { total: number; solved: number; difficulties: Map<string, number> }
    >();
    for (const question of questions) {
      const entry = map.get(question.topicId) ?? {
        total: 0,
        solved: 0,
        difficulties: new Map(),
      };
      entry.total += 1;
      if (solved.has(question.id)) entry.solved += 1;
      entry.difficulties.set(
        question.difficulty,
        (entry.difficulties.get(question.difficulty) ?? 0) + 1,
      );
      map.set(question.topicId, entry);
    }
    return Array.from(map.entries())
      .map(([id, value]) => ({
        id,
        title:
          topicsMeta.find((t) => t.id === id)?.title ??
          id.replace(/[-_]/g, " "),
        description: topicsMeta.find((t) => t.id === id)?.description,
        ...value,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [questions, topicsMeta, solved]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return topics.filter((topic) => {
      if (filter === "unsolved" && topic.solved === topic.total) return false;
      if (term === "") return true;
      return (
        topic.id.toLowerCase().includes(term) ||
        topic.title.toLowerCase().includes(term)
      );
    });
  }, [topics, search, filter]);

  const totalSolved = topics.reduce((sum, topic) => sum + topic.solved, 0);
  const completionPct =
    questions.length === 0
      ? 0
      : Math.round((totalSolved / questions.length) * 100);
  const resumeQuestion = useMemo(
    () =>
      lastPosition
        ? (questions.find((q) => q.id === lastPosition.questionId) ?? null)
        : null,
    [questions, lastPosition],
  );
  const scope =
    view === "categories"
      ? `${categories.length} categories`
      : `${topics.length} topics`;

  return (
    <PageShell
      title="Practice"
      subtitle={
        hydrated
          ? `${activeWorkspace?.name ?? "Workspace"} · ${scope} · ${totalSolved}/${questions.length} solved`
          : undefined
      }
      actions={
        <div className="flex items-center gap-2">
          <WorkspaceSwitcher />
          <Link
            href="/databases"
            className="flex h-7 items-center gap-1.5 border border-border bg-surface-alt px-2 font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <span className="size-1.5 bg-primary" />
            {dialectLabel(activeDialect)}
          </Link>
          <div className="flex border border-border">
            {(["categories", "topics"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setChoice(value)}
                className={cn(
                  "h-7 px-2.5 text-[11px] capitalize transition-colors",
                  view === value
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-dim hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-5">
        <div className="grid grid-cols-1 divide-y divide-border border border-border bg-surface md:grid-cols-[1fr_1fr_auto] md:divide-x md:divide-y-0">
          <div className="flex flex-col justify-between gap-2 px-4 py-3">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="section-label">Workspace Mastery</span>
              <span className="numeric font-mono font-semibold text-foreground">
                {completionPct}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-surface-alt">
              <div
                className={cn(
                  "h-full transition-[width] duration-300",
                  completionPct === 100 ? "bg-success" : "bg-primary",
                )}
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <div className="numeric flex items-center gap-3 font-mono text-[10.5px] text-muted-dim">
              <span>{totalSolved} solved</span>
              <span>{Math.max(0, questions.length - totalSolved)} remaining</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center border border-border bg-surface-alt text-primary">
                <Layers className="size-4" />
              </span>
              <div>
                <div className="text-[12px] font-semibold text-foreground">
                  {questions.length} challenges
                </div>
                <div className="text-[10.5px] text-muted-dim">
                  {categories.length} custom groups · {topics.length} curated topics
                </div>
              </div>
            </div>
            {completionPct === 100 && questions.length > 0 ? (
              <CheckCircle2 className="size-4 shrink-0 text-success" />
            ) : null}
          </div>

          {resumeQuestion && lastPosition ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 max-w-48">
                <div className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="size-2.5" />
                  Resume
                </div>
                <div className="mt-0.5 truncate text-[12px] font-medium text-foreground">
                  {resumeQuestion.title}
                </div>
              </div>
              <Button asChild size="sm" className="h-7 shrink-0 text-[11px]">
                <Link
                  href={`/learn/practice?topic=${lastPosition.topicId}&q=${lastPosition.questionId}`}
                >
                  Open
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center px-4 py-3 text-[11px] text-muted-dim">
              Pick a {view === "categories" ? "category" : "topic"} to practice
            </div>
          )}
        </div>

        {view === "categories" ? (
          <CategoriesSection />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-dim" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search topics"
                  aria-label="Search topics"
                  className="h-8 w-64 pl-8"
                />
              </div>
              <div className="flex border border-border">
                {(["all", "unsolved"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={cn(
                      "h-8 px-3 text-[11.5px] capitalize transition-colors",
                      filter === value
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-dim hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            {visible.length === 0 && hydrated ? (
              <p className="border border-border bg-surface px-4 py-10 text-center text-[12.5px] text-muted-dim">
                {questions.length === 0
                  ? "No questions installed yet."
                  : "No topics match the current filter."}
                {questions.length === 0 ? (
                  <>
                    {" "}
                    <Link
                      href="/import/resources"
                      className="text-primary hover:underline"
                    >
                      Browse resources
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}

            <div className="divide-y divide-border border border-border bg-surface">
              {visible.map((topic, index) => (
                <TopicRow key={topic.id} topic={topic} index={index} />
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

export default function LearnPage(): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <LearnContent />
    </Suspense>
  );
}

function TopicRow({
  topic,
  index,
}: {
  topic: {
    id: string;
    title: string;
    description?: string;
    total: number;
    solved: number;
    difficulties: Map<string, number>;
  };
  index: number;
}): React.ReactElement {
  const percent =
    topic.total === 0 ? 0 : Math.round((topic.solved / topic.total) * 100);
  const easy = topic.difficulties.get("easy") ?? 0;
  const medium = topic.difficulties.get("medium") ?? 0;
  const hard = topic.difficulties.get("hard") ?? 0;

  return (
    <Link
      href={`/learn/topic?id=${topic.id}`}
      className="group flex min-h-14 items-center gap-4 px-4 py-2.5 transition-colors hover:bg-surface-hover"
    >
      <span className="numeric w-6 shrink-0 font-mono text-[10px] text-muted-dim">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium capitalize text-foreground">
            {topic.title}
          </span>
        </div>
        {topic.description ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-dim">
            {topic.description}
          </p>
        ) : null}
        <div className="numeric mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-dim">
          <span>{topic.solved}/{topic.total} solved</span>
          {easy > 0 ? <span className="text-success">{easy}E</span> : null}
          {medium > 0 ? <span className="text-warning">{medium}M</span> : null}
          {hard > 0 ? <span className="text-error">{hard}H</span> : null}
        </div>
      </div>
      <div className="flex w-36 shrink-0 items-center gap-2">
        <div className="h-1.5 flex-1 bg-surface-alt">
          <div
            className={cn(
              "h-full transition-[width] duration-300",
              percent === 100 ? "bg-success" : "bg-primary",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="numeric w-9 text-right font-mono text-[10.5px] text-muted-dim">
          {percent}%
        </span>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-dim opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
