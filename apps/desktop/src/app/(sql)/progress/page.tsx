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

  const calendar = useMemo(() => buildCalendar(activity), [activity]);
  const activeDays = useMemo(() => {
    let count = 0;
    const todayKey = dateKey();
    for (const [key, value] of activity) {
      if (value > 0 && key <= todayKey) count += 1;
    }
    return count;
  }, [activity]);

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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => void exportFile()}
              >
                <Download className="size-3.5" /> Export
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Download progress history as JSON
            </TooltipContent>
          </Tooltip>
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    Reset
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Clear solved questions, streaks, points, and badges
              </TooltipContent>
            </Tooltip>
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
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
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
          <div className="flex h-9 items-center justify-between border-b border-border px-3">
            <span className="section-label">Activity</span>
            <span className="numeric text-[10.5px] text-muted-dim">
              {activeDays} active days · {streak.longestStreak}d longest · last
              12 months
            </span>
          </div>
          <div className="overflow-x-auto p-3">
            <Heatmap
              weeks={calendar.weeks}
              monthLabels={calendar.monthLabels}
            />
          </div>
          <div className="flex items-center justify-end gap-1.5 border-t border-border px-3 py-2 text-[9.5px] text-muted-dim">
            <span>less</span>
            <span className="size-[10px] border border-border/60 bg-surface-alt" />
            <span className="size-[10px] bg-primary/25" />
            <span className="size-[10px] bg-primary/50" />
            <span className="size-[10px] bg-primary/75" />
            <span className="size-[10px] bg-primary" />
            <span>more</span>
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

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;

function Heatmap({
  weeks,
  monthLabels,
}: {
  weeks: HeatmapCell[][];
  monthLabels: Array<{ column: number; label: string }>;
}): React.ReactElement {
  return (
    <div className="flex min-w-fit gap-[3px]">
      <div className="relative flex flex-col gap-[3px] pt-[14px]">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span
            key={`${day}-${index}`}
            className="flex h-[11px] items-center text-[8.5px] text-muted-dim"
          >
            {index % 2 === 1 ? day : ""}
          </span>
        ))}
      </div>
      <div>
        <div className="relative h-[14px]">
          {monthLabels.map((month) => (
            <span
              key={`${month.label}-${month.column}`}
              className="absolute text-[9px] text-muted-dim"
              style={{ left: `${month.column * STEP}px` }}
            >
              {month.label}
            </span>
          ))}
        </div>
        <div className="relative flex gap-[3px]">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              {week.map((cell, dayIndex) => {
                const box = (
                  <span
                    className={cn(
                      "size-[11px] border",
                      cell.future
                        ? "border-transparent bg-transparent"
                        : cell.level === 0
                          ? "border-border/60 bg-surface-alt"
                          : cn(
                              "border-transparent",
                              cell.level === 1 && "bg-primary/25",
                              cell.level === 2 && "bg-primary/50",
                              cell.level === 3 && "bg-primary/75",
                              cell.level === 4 && "bg-primary",
                            ),
                    )}
                  />
                );
                if (cell.date === "") {
                  return (
                    <span key={`empty-${weekIndex}-${dayIndex}`}>{box}</span>
                  );
                }
                return (
                  <Tooltip key={cell.date}>
                    <TooltipTrigger asChild>{box}</TooltipTrigger>
                    <TooltipContent>
                      {cell.date}: {cell.count} solved
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildCalendar(activity: Map<string, number>): {
  weeks: HeatmapCell[][];
  monthLabels: Array<{ column: number; label: string }>;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  start.setDate(start.getDate() - start.getDay());

  const totalDays =
    Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
  const weekCount = Math.ceil(totalDays / 7);

  const weeks: HeatmapCell[][] = [];
  const monthLabels: Array<{ column: number; label: string }> = [];
  let lastMonth = -1;

  for (let week = 0; week < weekCount; week += 1) {
    const column: HeatmapCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + week * 7 + day,
      );
      const future = date.getTime() > today.getTime();
      const key = dateKey(date);
      const count = future ? 0 : (activity.get(key) ?? 0);
      const level =
        count === 0 ? 0 : count < 2 ? 1 : count < 4 ? 2 : count < 8 ? 3 : 4;
      column.push({ date: future ? "" : key, count, level, future });
    }
    const month =
      column[0].date === "" ? -1 : Number(column[0].date.slice(5, 7)) - 1;
    if (column[0].date !== "" && month !== lastMonth) {
      monthLabels.push({
        column: week,
        label: new Date(`${column[0].date}T00:00:00`).toLocaleString(
          undefined,
          { month: "short" },
        ),
      });
      lastMonth = month;
    }
    weeks.push(column);
  }

  return { weeks, monthLabels };
}
