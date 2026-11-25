"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  Binary,
  CheckCircle2,
  Cpu,
  Flame,
  GraduationCap,
  Layers,
  Loader2,
  Network,
  Terminal,
} from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { LEARNING_SERVICES, type LearningService } from "@/lib/subjects";
import { cn } from "@/lib/utils";

const SERVICE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  sql: Terminal,
  dsa: Binary,
  "computer-networking": Network,
  os: Cpu,
  "system-design": Layers,
};

export default function HomePage(): React.ReactElement {
  const hydrated = usePackStore((state) => state.hydrated);
  const databases = usePackStore((state) => state.databases);
  const questions = usePackStore((state) => state.questions);
  const totalPoints = useProgressStore((state) => state.totalPoints);
  const solvedCount = useProgressStore((state) => state.solvedQuestions.size);
  const streak = useProgressStore((state) => state.streak.currentStreak);
  const lastPosition = useProgressStore((state) => state.lastPosition);

  const lastQuestion = useMemo(
    () =>
      questions.find((question) => question.id === lastPosition?.questionId) ??
      null,
    [lastPosition, questions],
  );

  const empty = databases.length === 0 || questions.length === 0;

  return (
    <PageShell
      title="Overview"
      subtitle={
        hydrated
          ? `${databases.length} databases · ${questions.length} questions · ${solvedCount} solved`
          : undefined
      }
      actions={<ReadyBadge hydrated={hydrated} empty={empty} />}
    >
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-4">
        {empty ? (
          <GetStarted hydrated={hydrated} />
        ) : (
          <section className="space-y-2">
            <h2 className="section-label">Your progress</h2>
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
              <div className="flex items-center justify-between gap-4 border border-border bg-surface px-3 py-2.5">
                <div className="min-w-0">
                  <div className="section-label">Continue where you left off</div>
                  <div className="mt-0.5 truncate text-[12.5px] font-medium">
                    {lastQuestion.title}
                  </div>
                </div>
                <Button asChild size="sm" className="h-7 gap-1.5 text-[11px]">
                  <Link
                    href={`/learn/practice?topic=${lastPosition.topicId}&q=${lastPosition.questionId}`}
                  >
                    Resume <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="section-label">Learning services</h2>
            <span className="text-[10.5px] text-muted-dim">
              SQL ships today · more subjects follow
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LEARNING_SERVICES.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                empty={empty}
              />
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function ServiceCard({
  service,
  empty,
}: {
  service: LearningService;
  empty: boolean;
}): React.ReactElement {
  const Icon = SERVICE_ICONS[service.id] ?? Terminal;
  const available = service.state === "available";
  const href = available
    ? empty
      ? "/import/resources"
      : (service.href ?? "/learn")
    : null;

  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex size-6 items-center justify-center",
            available
              ? "bg-primary/10 text-primary"
              : "bg-surface-alt text-muted-dim",
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span
          className={cn(
            "border px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider",
            available
              ? "border-success/40 text-success"
              : "border-border text-muted-dim",
          )}
        >
          {available ? "Available" : "Planned"}
        </span>
      </span>
      <span className="mt-2.5 block text-[12.5px] font-semibold">
        {service.label}
      </span>
      <span className="mt-1 block text-[11px] leading-relaxed text-muted">
        {service.summary}
      </span>
      <span
        className={cn(
          "mt-auto flex items-center gap-1 pt-2.5 text-[11px]",
          available ? "text-primary" : "text-muted-dim",
        )}
      >
        {available
          ? empty
            ? "Install resources"
            : "Open practice"
          : "Not yet available"}
        {available ? <ArrowRight className="size-3" /> : null}
      </span>
    </>
  );

  const className = cn(
    "flex flex-col border p-3 transition-colors",
    available
      ? "border-border bg-surface hover:border-primary/40 hover:bg-surface-hover"
      : "border-border/60 bg-surface-alt/40",
  );

  return href !== null ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className} aria-disabled="true">
      {body}
    </div>
  );
}

function GetStarted({
  hydrated,
}: {
  hydrated: boolean;
}): React.ReactElement {
  if (!hydrated) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <section className="flex items-center justify-between gap-4 border border-border bg-surface px-4 py-4">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">Install learning resources</div>
        <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-muted">
          SQL and Interview SQL ship as validated bundles: the seeded database,
          its questions and its notes are checked together before anything is
          stored.
        </p>
      </div>
      <Button asChild size="sm" className="h-7 gap-1.5 text-[11px]">
        <Link href="/import/resources">
          Browse resources <ArrowRight className="size-3" />
        </Link>
      </Button>
    </section>
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
    <div className="border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-dim">
        {icon}
        <span className="section-label">{label}</span>
      </div>
      <div className="numeric mt-1 text-xl font-semibold leading-none">
        {value}
        {suffix ? <span className="text-[12px] text-muted-dim">{suffix}</span> : null}
      </div>
    </div>
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
      <span className="flex items-center gap-1.5 text-[10.5px] text-muted-dim">
        <Loader2 className="size-3 animate-spin" /> Loading
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        empty ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
      )}
    >
      <span className={cn("size-1.5", empty ? "bg-warning" : "bg-success")} />
      {empty ? "No resources" : "Ready"}
    </span>
  );
}
