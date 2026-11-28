"use client";

import { useMemo } from "react";
import {
  Award,
  Download,
  Flame,
  Lock,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BADGE_DEFINITIONS } from "@/features/badges/badgeDefinitions";
import { useProgressStore } from "@/stores/useProgressStore";
import { usePackStore } from "@/stores/usePackStore";
import { saveTextFile } from "@/lib/save-file";
import { dateKey } from "@/lib/date-key";
import { cn } from "@/lib/utils";

export default function ProgressPage(): React.ReactElement {
  const solvedQuestions = useProgressStore((state) => state.solvedQuestions);
  const totalPoints = useProgressStore((state) => state.totalPoints);
  const streak = useProgressStore((state) => state.streak);
  const activity = useProgressStore((state) => state.activity);
  const badges = useProgressStore((state) => state.badges);
  const exportProgress = useProgressStore((state) => state.exportProgress);
  const resetProgress = useProgressStore((state) => state.resetProgress);
  const questionTotal = usePackStore((state) => state.questions.length);

  const solved = solvedQuestions.size;
  const completion =
    questionTotal === 0 ? 0 : Math.round((solved / questionTotal) * 100);
  const bestTime = useMemo(() => {
    let best = Number.POSITIVE_INFINITY;
    for (const entry of solvedQuestions.values())
      best = Math.min(best, entry.bestTimeMs);
    return Number.isFinite(best) ? best : null;
  }, [solvedQuestions]);

  const calendar = useMemo(() => buildMonthlyCalendar(activity), [activity]);
  const activeDays = calendar.activeDays;

  const exportFile = async (): Promise<void> => {
    const saved = await saveTextFile(
      "logixzen-progress.json",
      exportProgress(),
      [{ name: "JSON", extensions: ["json"] }],
    );
    if (!saved) {
      const blob = new Blob([exportProgress()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "logixzen-progress.json";
      anchor.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <PageShell
      title="Progress"
      subtitle={`${solved}/${questionTotal || "—"} solved · ${totalPoints} points`}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => void exportFile()}>
            <Download data-icon="inline-start" />
            Export
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all progress?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes solved history, points, streaks and
                  badges on this machine.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => resetProgress()}
                >
                  Reset everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      }
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat
            label="Completion"
            value={`${completion}%`}
            hint={
              questionTotal > 0
                ? `of ${questionTotal} questions`
                : "no pack installed"
            }
            icon={<Target className="size-3.5" />}
            accent
          />
          <Stat
            label="Solved"
            value={String(solved)}
            hint={`${totalPoints} points earned`}
            icon={<TrendingUp className="size-3.5" />}
          />
          <Stat
            label="Current streak"
            value={`${streak.currentStreak}d`}
            hint={`longest ${streak.longestStreak}d`}
            icon={<Flame className="size-3.5" />}
          />
          <Stat
            label="Best time"
            value={bestTime === null ? "—" : `${(bestTime / 1000).toFixed(1)}s`}
            hint="fastest solve"
            icon={<Trophy className="size-3.5" />}
          />
        </div>

        <div className="border border-border bg-surface px-3 py-2.5">
          <div className="flex items-center justify-between text-[10px] text-muted-dim">
            <span className="section-label">Completion</span>
            <span className="numeric">
              {solved}/{questionTotal > 0 ? questionTotal : "—"}
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full bg-surface-alt">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        <section className="border border-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="section-label">
              {calendar.totalCount} submissions in the last year
            </span>
            <span className="numeric text-[10.5px] text-muted-dim">
              {activeDays} active days · {streak.longestStreak}d longest streak
            </span>
          </div>
          <div className="overflow-x-auto px-4 py-3.5">
            <MonthlyHeatmap months={calendar.months} />
          </div>
          <div className="flex items-center justify-end gap-1.5 border-t border-border px-3 py-2 text-[9.5px] text-muted-dim">
            <span>Less</span>
            <span className="size-[11px] border border-border/60 bg-surface-alt" />
            <span className="size-[11px] bg-primary/25" />
            <span className="size-[11px] bg-primary/50" />
            <span className="size-[11px] bg-primary/75" />
            <span className="size-[11px] bg-primary" />
            <span>More</span>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="size-3.5 text-warning" />
              <span className="section-label">Badges</span>
            </div>
            <span className="numeric text-[10.5px] text-muted-dim">
              {badges.earned.size}/{BADGE_DEFINITIONS.length} earned
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {BADGE_DEFINITIONS.map((badge) => {
              const earned = badges.earned.has(badge.id);
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "flex flex-col items-center gap-1.5 border p-3 text-center transition-colors",
                    earned
                      ? "border-warning/40 bg-warning/5"
                      : "border-border bg-surface-alt/50",
                  )}
                >
                  {earned ? (
                    <Award className="size-5 text-warning" />
                  ) : (
                    <Lock className="size-5 text-muted-dim" />
                  )}
                  <span className="text-[11.5px] font-semibold">
                    {badge.title}
                  </span>
                  <span className="text-[10px] leading-tight text-muted-dim">
                    {badge.description}
                  </span>
                  {earned ? (
                    <span className="numeric text-[9px] text-muted-dim">
                      {new Date(
                        badges.earned.get(badge.id)?.timestamp ?? 0,
                      ).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-[9px] uppercase tracking-wider text-muted-dim">
                      locked
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: boolean;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "relative border bg-surface px-4 py-3",
        accent ? "border-primary/40" : "border-border",
      )}
    >
      {accent ? (
        <span
          className="absolute left-0 top-0 h-full w-[2px] bg-primary"
          aria-hidden="true"
        />
      ) : null}
      <div className="flex items-center gap-1.5 text-muted-dim">
        {icon}
        <span className="section-label">{label}</span>
      </div>
      <div className="numeric mt-1.5 text-2xl font-semibold leading-none">
        {value}
      </div>
      <div className="mt-1.5 text-[10px] text-muted-dim">{hint}</div>
    </div>
  );
}

interface HeatmapCell {
  date: string;
  count: number;
  level: number;
  future: boolean;
}

interface MonthBlock {
  key: string;
  label: string;
  isCurrentMonth: boolean;
  columns: Array<Array<HeatmapCell | null>>;
}

function MonthlyHeatmap({
  months,
}: {
  months: MonthBlock[];
}): React.ReactElement {
  return (
    <div className="flex w-full min-w-fit items-start justify-between gap-2.5">
      {months.map((month) => (
        <div
          key={month.key}
          className="flex flex-col items-center gap-2"
        >
          <div className="flex gap-[2px]">
            {month.columns.map((column, colIndex) => (
              <div key={colIndex} className="flex flex-col gap-[2px]">
                {column.map((cell, rowIndex) => {
                  if (cell === null) {
                    return (
                      <span
                        key={`pad-${colIndex}-${rowIndex}`}
                        aria-hidden="true"
                        className="block size-[11px]"
                      />
                    );
                  }

                  const box = (
                    <span
                      aria-label={
                        cell.future
                          ? `${cell.date} upcoming`
                          : `${cell.count} ${cell.count === 1 ? "solve" : "solves"} on ${cell.date}`
                      }
                      className={cn(
                        "block size-[11px] border transition-colors",
                        cell.future
                          ? "border-border/25 bg-surface-alt/30"
                          : cell.level === 0
                            ? "border-border/70 bg-surface-alt hover:border-primary/50"
                            : cn(
                                "border-transparent hover:border-foreground/40",
                                cell.level === 1 && "bg-primary/25",
                                cell.level === 2 && "bg-primary/50",
                                cell.level === 3 && "bg-primary/75",
                                cell.level === 4 && "bg-primary",
                              ),
                      )}
                    />
                  );

                  if (cell.future) {
                    return <span key={cell.date}>{box}</span>;
                  }

                  return (
                    <Tooltip key={cell.date}>
                      <TooltipTrigger asChild>{box}</TooltipTrigger>
                      <TooltipContent className="font-mono text-[10.5px]">
                        {cell.count} {cell.count === 1 ? "solve" : "solves"} on{" "}
                        {cell.date}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
          <span
            className={cn(
              "font-mono text-[10px] leading-none",
              month.isCurrentMonth
                ? "font-semibold text-foreground"
                : "text-muted-dim",
            )}
          >
            {month.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function buildMonthlyCalendar(activity: Map<string, number>): {
  months: MonthBlock[];
  totalCount: number;
  activeDays: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const months: MonthBlock[] = [];
  let totalCount = 0;
  let activeDays = 0;

  for (let offset = 11; offset >= 0; offset -= 1) {
    const monthStart = new Date(
      today.getFullYear(),
      today.getMonth() - offset,
      1,
    );
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const columnsCount = Math.ceil(daysInMonth / 7);
    const columns: Array<Array<HeatmapCell | null>> = [];

    for (let col = 0; col < columnsCount; col += 1) {
      const column: Array<HeatmapCell | null> = [];
      for (let row = 0; row < 7; row += 1) {
        const dayNumber = col * 7 + row + 1;
        if (dayNumber > daysInMonth) {
          column.push(null);
          continue;
        }
        const date = new Date(year, month, dayNumber);
        const future = date.getTime() > today.getTime();
        const key = dateKey(date);
        const count = future ? 0 : (activity.get(key) ?? 0);
        if (!future && count > 0) {
          totalCount += count;
          activeDays += 1;
        }
        const level =
          count === 0 ? 0 : count < 2 ? 1 : count < 4 ? 2 : count < 8 ? 3 : 4;
        column.push({ date: key, count, level, future });
      }
      columns.push(column);
    }

    const shortMonth = monthStart.toLocaleString("en-US", { month: "short" });
    const label =
      month === 0 || offset === 11
        ? `${shortMonth} '${String(year).slice(-2)}`
        : shortMonth;

    months.push({
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label,
      isCurrentMonth: offset === 0,
      columns,
    });
  }

  return { months, totalCount, activeDays };
}
