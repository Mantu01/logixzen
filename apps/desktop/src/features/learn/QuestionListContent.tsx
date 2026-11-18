"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, Search, X } from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { Input } from "@/components/ui/input";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { cn } from "@/lib/utils";
import type { Question } from "@logixzen/shared/content";

export function QuestionListContent({
  topicId,
}: {
  topicId: string;
}): React.ReactElement {
  const questions = usePackStore((state) => state.questions);
  const hydrated = usePackStore((state) => state.hydrated);
  const solved = useProgressStore((state) => state.solvedQuestions);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<
    "all" | "easy" | "medium" | "hard"
  >("all");

  const topicQuestions = useMemo(
    () => questions.filter((question) => question.topicId === topicId),
    [questions, topicId],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return topicQuestions.filter((question) => {
      if (difficulty !== "all" && question.difficulty !== difficulty)
        return false;
      if (term === "") return true;
      return (
        question.title.toLowerCase().includes(term) ||
        question.description.toLowerCase().includes(term) ||
        question.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
  }, [topicQuestions, search, difficulty]);

  const solvedCount = topicQuestions.filter((question) =>
    solved.has(question.id),
  ).length;

  return (
    <PageShell
      title={topicId.replace(/[-_]/g, " ")}
      subtitle={
        hydrated ? `${solvedCount}/${topicQuestions.length} solved` : undefined
      }
      actions={
        <Link
          href="/learn"
          className="flex items-center gap-1 text-[11.5px] text-muted transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" /> All topics
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

        {topicQuestions.length === 0 && hydrated ? (
          <p className="border border-border bg-surface px-4 py-10 text-center text-[12.5px] text-muted-dim">
            No questions in this topic. Import the questions pack from the Data
            Hub.
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
      {!solved ? <X className="invisible size-3" /> : null}
    </Link>
  );
}
