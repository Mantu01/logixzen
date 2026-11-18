"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronRight, Search } from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { cn } from "@/lib/utils";

export default function LearnPage(): React.ReactElement {
  const questions = usePackStore((state) => state.questions);
  const hydrated = usePackStore((state) => state.hydrated);
  const solved = useProgressStore((state) => state.solvedQuestions);
  const lastPosition = useProgressStore((state) => state.lastPosition);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unsolved">("all");

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
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [questions, solved]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return topics.filter((topic) => {
      if (filter === "unsolved" && topic.solved === topic.total) return false;
      if (term === "") return true;
      return topic.id.toLowerCase().includes(term);
    });
  }, [topics, search, filter]);

  const totalSolved = topics.reduce((sum, topic) => sum + topic.solved, 0);

  return (
    <PageShell
      title="Practice"
      subtitle={
        hydrated
          ? `${topics.length} topics · ${totalSolved}/${questions.length} solved`
          : undefined
      }
    >
      <div className="mx-auto max-w-4xl px-5 py-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-dim" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search topics"
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
          {lastPosition ? (
            <Link
              href={`/learn/practice?topic=${lastPosition.topicId}&q=${lastPosition.questionId}`}
              className="ml-auto"
            >
              <Button size="sm" className="gap-1.5">
                Continue <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          ) : null}
        </div>

        {visible.length === 0 && hydrated ? (
          <p className="border border-border bg-surface px-4 py-10 text-center text-[12.5px] text-muted-dim">
            {questions.length === 0
              ? "No questions found. Import the questions pack from the Data Hub."
              : "No topics match the current filter."}
          </p>
        ) : null}

        <div className="divide-y divide-border border border-border bg-surface">
          {visible.map((topic) => {
            const percent =
              topic.total === 0
                ? 0
                : Math.round((topic.solved / topic.total) * 100);
            return (
              <Link
                key={topic.id}
                href={`/learn/topic?id=${topic.id}`}
                className="group flex h-14 items-center gap-4 px-4 transition-colors hover:bg-surface-hover"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium capitalize">
                    {topic.id.replace(/[-_]/g, " ")}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-[10.5px] text-muted-dim">
                    <span className="numeric">{topic.total} questions</span>
                    <span className="numeric">{topic.solved} solved</span>
                    <span className="flex gap-1">
                      {Array.from(topic.difficulties.entries())
                        .filter(([, count]) => count > 0)
                        .map(([difficulty, count]) => (
                          <span key={difficulty} className="numeric">
                            {count} {difficulty.slice(0, 2)}
                          </span>
                        ))}
                    </span>
                  </div>
                </div>
                <div className="flex w-40 shrink-0 items-center gap-2">
                  <div className="h-1 flex-1 bg-surface-hover">
                    <div
                      className={cn(
                        "h-full",
                        percent === 100 ? "bg-success" : "bg-primary",
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="numeric w-8 text-right text-[10.5px] text-muted-dim">
                    {percent}%
                  </span>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-dim opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
