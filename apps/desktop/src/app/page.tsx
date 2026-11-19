"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  BarChart3,
  Binary,
  BookOpen,
  CheckCircle2,
  Cpu,
  Database,
  Flame,
  GraduationCap,
  Import,
  Layers,
  Loader2,
  Network,
  Package,
  Settings2,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { LEARNING_SERVICES, type LearningService } from "@/lib/subjects";
import { cn } from "@/lib/utils";

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> =
  {
    sql: Terminal,
    dsa: Binary,
    "computer-networking": Network,
    os: Cpu,
    "system-design": Layers,
  };

const WORKSPACE: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { href: "/playground", label: "Editor", icon: Terminal },
  { href: "/databases", label: "Databases", icon: Database },
  { href: "/schema", label: "Schema", icon: Network },
  { href: "/resources", label: "Resources", icon: Package },
  { href: "/import", label: "Data Hub", icon: Import },
  { href: "/learn", label: "Practice", icon: GraduationCap },
  { href: "/notes", label: "Notes", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export default function HomePage(): React.ReactElement {
  const hydrated = usePackStore((state) => state.hydrated);
  const databases = usePackStore((state) => state.databases);
  const questions = usePackStore((state) => state.questions);
  const totalPoints = useProgressStore((state) => state.totalPoints);
  const solvedCount = useProgressStore((state) => state.solvedQuestions.size);
  const streak = useProgressStore((state) => state.streak.currentStreak);
  const lastPosition = useProgressStore((state) => state.lastPosition);

  const lastQuestion = useMemo(() => {
    if (!lastPosition) return null;
    return (
      questions.find((question) => question.id === lastPosition.questionId) ??
      null
    );
  }, [lastPosition, questions]);

  const empty = databases.length === 0 || questions.length === 0;

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-8 py-9">
        <header className="flex items-start justify-between gap-6 border-b border-border pb-6">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
              LogixZen
            </h1>
            <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-muted">
              Practice environments that run entirely on your machine. Pick a
              learning service to begin.
            </p>
          </div>
          <ReadyBadge hydrated={hydrated} empty={empty} />
        </header>

        <section className="pt-7">
          <SectionHeading
            title="Learning services"
            note="Only SQL ships today — the rest are on the roadmap"
          />
          <div className="mt-2.5 grid grid-cols-3 gap-3">
            {LEARNING_SERVICES.map((service) => (
              <ServiceCard key={service.id} service={service} empty={empty} />
            ))}
          </div>
        </section>

        <section className="pt-7">
          <SectionHeading
            title={empty ? "Get started" : "Your progress"}
            note={
              empty
                ? "Content installs as validated resources, never as loose files"
                : `${databases.length} databases · ${questions.length} questions`
            }
          />
          {!hydrated ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : empty ? (
            <GetStarted />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
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
                    <div className="section-label">Continue where you left off</div>
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
            </div>
          )}
        </section>

        <section className="pt-7 pb-4">
          <SectionHeading
            title="Workspace"
            note="Everything else lives one click away"
          />
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {WORKSPACE.map((entry) => {
              const Icon = entry.icon;
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="group flex h-9 items-center gap-2 border border-border bg-surface px-3 text-[12.5px] transition-colors hover:border-primary/40 hover:bg-surface-hover"
                >
                  <Icon className="size-3.5 shrink-0 text-muted-dim group-hover:text-primary" />
                  <span className="flex-1 truncate font-medium">
                    {entry.label}
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-dim opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  note,
}: {
  title: string;
  note: string;
}): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="section-label">{title}</h2>
      <span className="text-[10.5px] text-muted-dim">{note}</span>
    </div>
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
      ? "/resources"
      : (service.href ?? "/learn")
    : null;

  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex size-7 items-center justify-center",
            available ? "bg-primary/10 text-primary" : "bg-surface-alt text-muted-dim",
          )}
        >
          <Icon className="size-4" />
        </span>
        <span
          className={cn(
            "border px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider",
            available
              ? "border-success/40 text-success"
              : "border-border text-muted-dim",
          )}
        >
          {available ? "Available" : "Coming soon"}
        </span>
      </span>
      <span className="mt-3 block text-[14px] font-semibold">
        {service.label}
      </span>
      <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
        {service.summary}
      </span>
      {available ? (
        <span className="mt-3 flex items-center gap-1 text-[11.5px] text-primary">
          {empty ? "Install resources" : "Open practice"}
          <ArrowRight className="size-3.5" />
        </span>
      ) : (
        <span className="mt-3 block text-[11.5px] text-muted-dim">
          Not yet available
        </span>
      )}
    </>
  );

  const className = cn(
    "flex flex-col border p-4 transition-colors",
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

function GetStarted(): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 border border-primary/40 bg-primary/5 px-4 py-4">
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold">
          Install our resources
        </div>
        <p className="mt-1 max-w-lg text-[11.5px] leading-relaxed text-muted">
          Basic SQL and Interview SQL each ship as one validated bundle — the
          seeded database, its questions and its study notes, checked together
          before anything is stored.
        </p>
      </div>
      <Link href="/resources">
        <Button className="gap-1.5">
          Browse resources <ArrowRight className="size-3.5" />
        </Button>
      </Link>
    </div>
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
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider",
        empty ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
      )}
    >
      <span className={cn("size-1.5", empty ? "bg-warning" : "bg-success")} />
      {empty ? "No data" : "Ready"}
    </span>
  );
}
