"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, Search, X } from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { Input } from "@/components/ui/input";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { cn } from "@/lib/utils";
import { UNCATEGORIZED, questionsInCategory } from "@/lib/categories";
import type { Question, Topic } from "@logixzen/shared/content";

type ListSource =
  | { kind: "topic"; id: string }
  | { kind: "category"; id: string };

export function QuestionListContent({
  source,
}: {
  source: ListSource;
}): React.ReactElement {
  const questions = usePackStore((state) => state.questions);
  const topics = usePackStore((state) => state.topics);
  const categories = usePackStore((state) => state.categories);
  const assignments = usePackStore((state) => state.questionCategory);
  const hydrated = usePackStore((state) => state.hydrated);
  const solved = useProgressStore((state) => state.solvedQuestions);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<
    "all" | "easy" | "medium" | "hard"
  >("all");

  const sourceQuestions = useMemo(
    () =>
      source.kind === "topic"
        ? questions.filter((question) => question.topicId === source.id)
        : questionsInCategory(questions, assignments, source.id),
    [questions, source, assignments],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sourceQuestions.filter((question) => {
      if (difficulty !== "all" && question.difficulty !== difficulty)
        return false;
      if (term === "") return true;
      return (
        question.title.toLowerCase().includes(term) ||
        question.description.toLowerCase().includes(term) ||
        question.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
  }, [sourceQuestions, search, difficulty]);

  const solvedCount = sourceQuestions.filter((question) =>
    solved.has(question.id),
  ).length;

  const title =
    source.kind === "topic"
      ? topicTitle(topics, source.id)
      : categoryTitle(categories, source.id);

  return (
    <PageShell
      title={title}
      subtitle={
        hydrated ? `${solvedCount}/${sourceQuestions.length} solved` : undefined
      }
      actions={
        <Link
          href="/learn"
          className="flex items-center gap-1 text-[11.5px] text-muted transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />{" "}
          {source.kind === "topic" ? "All topics" : "All categories"}
        </Link>
      }
    >
      <div className="mx-auto max-w-4xl px-5 py-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-dim" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search questions"
              className="h-8 w-64 pl-8"
            />
          </div>
          <div className="flex border border-border">
            {(["all", "easy", "medium", "hard"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDifficulty(value)}
                className={cn(
                  "h-8 px-3 text-[11.5px] capitalize transition-colors",
                  difficulty === value
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-dim hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {sourceQuestions.length === 0 && hydrated ? (
          <p className="border border-border bg-surface px-4 py-10 text-center text-[12.5px] text-muted-dim">
            No questions here yet.{" "}
            <Link href="/resources" className="text-primary hover:underline">
              Install a resource
            </Link>{" "}
            or pick different questions for this category.
          </p>
        ) : null}

        <div className="divide-y divide-border border border-border bg-surface">
          {visible.map((question, index) => (
            <QuestionRow
              key={question.id}
              question={question}
              index={index}
              solved={solved.has(question.id)}
            />
          ))}
        </div>
      </div>
    </PageShell>
  );
}

function topicTitle(topics: Topic[], id: string): string {
  return topics.find((topic) => topic.id === id)?.title ?? id.replace(/[-_]+/g, " ");
}

function categoryTitle(
  categories: Array<{ id: string; name: string }>,
  id: string,
): string {
  if (id === UNCATEGORIZED) return "Uncategorised";
  return categories.find((category) => category.id === id)?.name ?? "Category";
}

function QuestionRow({
  question,
  index,
  solved,
}: {
  question: Question;
  index: number;
  solved: boolean;
}): React.ReactElement {
  return (
    <Link
      href={`/learn/practice?topic=${question.topicId}&q=${question.id}`}
      className="group flex h-12 items-center gap-3 px-4 transition-colors hover:bg-surface-hover"
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center border text-[10px]",
          solved
            ? "border-success/40 bg-success/10 text-success"
            : "border-border text-muted-dim",
        )}
      >
        {solved ? <Check className="size-3" /> : index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">
          {question.title}
        </span>
        <span className="block truncate text-[10.5px] text-muted-dim">
          {question.tags.join(" · ")}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 border px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wider",
          question.difficulty === "easy" && "border-success/40 text-success",
          question.difficulty === "medium" && "border-warning/40 text-warning",
          question.difficulty === "hard" && "border-error/40 text-error",
        )}
      >
        {question.difficulty}
      </span>
      <span className="numeric w-10 shrink-0 text-right text-[10.5px] text-muted-dim">
        {question.points} pts
      </span>
      <X className="invisible size-3" />
    </Link>
  );
}
