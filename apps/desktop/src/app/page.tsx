"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  Flame,
  GraduationCap,
  Import,
  Loader2,
  Terminal,
} from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";

export default function HomePage(): React.ReactElement {
  const hydrated = usePackStore((state) => state.hydrated);
  const databases = usePackStore((state) => state.databases);
  const questions = usePackStore((state) => state.questions);
  const totalPoints = useProgressStore((state) => state.totalPoints);
  const solvedCount = useProgressStore((state) => state.solvedQuestions.size);
  const streak = useProgressStore((state) => state.streak.currentStreak);
  const lastPosition = useProgressStore((state) => state.lastPosition);

  const topics = useMemo(() => {
    const map = new Map<string, { id: string; count: number }>();
    for (const question of questions) {
      const entry = map.get(question.topicId) ?? {
        id: question.topicId,
        count: 0,
      };
      entry.count += 1;
      map.set(question.topicId, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [questions]);

  const lastQuestion = useMemo(() => {
    if (!lastPosition) return null;
    return (
      questions.find((question) => question.id === lastPosition.questionId) ??
      null
    );
  }, [lastPosition, questions]);

  const empty = databases.length === 0 || questions.length === 0;

  return (
    <PageShell
      title="Dashboard"
      subtitle={
        empty
          ? "Set up your data to begin"
          : `${questions.length} questions · ${databases.length} databases`
      }
      actions={<ReadyBadge hydrated={hydrated} empty={empty} />}
    >
      <div className="mx-auto max-w-4xl px-5 py-6">
        {empty ? (
          <EmptyState hydrated={hydrated} />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="Points"
                value={totalPoints}
                icon={<GraduationCap className="size-3.5" />}
              />
              <StatCard
                label="Solved"
                value={solvedCount}
                icon={<CheckCircle2 className="size-3.5" />}
              />
              <StatCard
                label="Streak"
                value={streak}
                suffix="d"
                icon={<Flame className="size-3.5" />}
              />
            </div>

            {lastQuestion && lastPosition ? (
              <div className="flex items-center justify-between gap-4 border border-primary/40 bg-primary/5 px-4 py-3">
                <div className="min-w-0">
                  <div className="section-label">
                    Continue where you left off
                  </div>
                  <div className="mt-0.5 truncate text-[13px] font-medium">
                    {lastQuestion.title}
                  </div>
                </div>
                <Link
                  href={`/learn/practice?topic=${lastPosition.topicId}&q=${lastPosition.questionId}`}
                >
                  <Button size="sm" className="gap-1.5">
                    Resume <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
              </div>
            ) : null}

            <section>
              <div className="mb-2 flex items-center justify-between">
                <span className="section-label">Topics</span>
                <Link
                  href="/learn"
                  className="flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-foreground"
                >
                  All topics <ArrowRight className="size-3" />
                </Link>
              </div>
              <div className="divide-y divide-border border border-border bg-surface">
                {topics.map((topic, index) => (
                  <Link
                    key={topic.id}
                    href={`/learn/topic?id=${topic.id}`}
                    className="group flex h-10 items-center gap-3 px-3 transition-colors hover:bg-surface-hover"
                  >
                    <span className="numeric w-6 shrink-0 font-mono text-[10px] text-muted-dim">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium capitalize">
                      {topic.id.replace(/[-_]/g, " ")}
                    </span>
                    <span className="numeric shrink-0 text-[11px] text-muted-dim">
                      {topic.count} Q
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-dim opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <span className="section-label">Databases</span>
                <Link
                  href="/schema"
                  className="flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-foreground"
                >
                  Manage <ArrowRight className="size-3" />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {databases.slice(0, 3).map((dataset) => (
                  <Link
                    key={dataset.id}
                    href="/schema"
                    className="group border border-border bg-surface p-3 transition-colors hover:border-primary/40 hover:bg-surface-hover"
                  >
                    <div className="flex items-center gap-2">
                      <Database className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate font-mono text-[12px] font-medium">
                        {dataset.name}
                      </span>
                    </div>
                    <div className="numeric mt-1 text-[10.5px] text-muted-dim">
                      {dataset.tables.length} tables
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function ReadyBadge({
  hydrated,
  empty,
}: {
  hydrated: boolean;
  empty: boolean;
}): React.ReactElement {
  if (!hydrated) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-muted-dim">
        <Loader2 className="size-3 animate-spin" /> Loading
      </span>
    );
  }
  return (
    <span
      className={`flex items-center gap-1.5 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider ${
        empty ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
      }`}
    >
      <span className={`size-1.5 ${empty ? "bg-warning" : "bg-success"}`} />
      {empty ? "No data" : "Ready"}
    </span>
  );
}

function StatCard({
  label,
  value,
  suffix,
  icon,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-dim">
        {icon}
        <span className="section-label">{label}</span>
      </div>
      <div className="numeric mt-1 text-2xl font-semibold leading-none">
        {value}
        {suffix ? (
          <span className="text-[13px] text-muted-dim">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ hydrated }: { hydrated: boolean }): React.ReactElement {
  if (!hydrated) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  const steps = [
    {
      href: "/import",
      icon: <Import className="size-4" />,
      title: "Import data packs",
      body: "Install the official packs, or copy an AI prompt to generate your own.",
    },
    {
      href: "/schema",
      icon: <Database className="size-4" />,
      title: "Explore the schema",
      body: "Load a .sql file, read the ER diagram and browse every table.",
    },
    {
      href: "/playground",
      icon: <Terminal className="size-4" />,
      title: "Open the editor",
      body: "Write queries with autocomplete against any database you own.",
    },
    {
      href: "/learn",
      icon: <BookOpen className="size-4" />,
      title: "Start practicing",
      body: "Solve questions against real test cases. Hints, points and streaks included.",
    },
  ];
  return (
    <div>
      <div className="border border-border bg-surface p-5">
        <h2 className="text-[15px] font-semibold">Welcome to LogixZen</h2>
        <p className="mt-1 max-w-lg text-[12.5px] text-muted">
          LogixZen runs fully offline. Study content lives in data packs you
          import — databases, questions and notes. SQL first, more subjects
          later.
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {steps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="group flex flex-col gap-1 border border-border bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-surface-hover"
          >
            <span className="flex size-7 items-center justify-center bg-surface-alt text-primary">
              {step.icon}
            </span>
            <span className="mt-1 text-[13px] font-semibold">{step.title}</span>
            <span className="text-[11.5px] leading-relaxed text-muted">
              {step.body}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
