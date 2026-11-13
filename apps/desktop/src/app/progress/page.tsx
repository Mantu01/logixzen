"use client";

import { useMemo, useState } from "react";
import { Award, Download, Flame, Target, TrendingUp, Trophy } from "lucide-react";
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
import { BADGE_DEFINITIONS } from "@/features/badges/badgeDefinitions";
import { useProgressStore } from "@/stores/useProgressStore";
import { usePackStore } from "@/stores/usePackStore";
import { saveTextFile } from "@/lib/save-file";
import { cn } from "@/lib/utils";

export default function ProgressPage(): React.ReactElement {
  const solvedQuestions = useProgressStore((state) => state.solvedQuestions);
  const totalPoints = useProgressStore((state) => state.totalPoints);
  const streak = useProgressStore((state) => state.streak);
  const activity = useProgressStore((state) => state.activity);
  const badges = useProgressStore((state) => state.badges);
  const exportProgress = useProgressStore((state) => state.exportProgress);
  const importProgress = useProgressStore((state) => state.importProgress);
  const resetProgress = useProgressStore((state) => state.resetProgress);
  const questionTotal = usePackStore((state) => state.questions.length);

  const [importMessage, setImportMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const solved = solvedQuestions.size;
  const completion = questionTotal === 0 ? 0 : Math.round((solved / questionTotal) * 100);
  const bestTime = useMemo(() => {
    let best = Number.POSITIVE_INFINITY;
    for (const entry of solvedQuestions.values()) best = Math.min(best, entry.bestTimeMs);
    return Number.isFinite(best) ? best : null;
  }, [solvedQuestions]);

  const heatmap = useMemo(() => buildHeatmap(activity), [activity]);

  const exportFile = async (): Promise<void> => {
    const saved = await saveTextFile("logixzen-progress.json", exportProgress(), [
      { name: "JSON", extensions: ["json"] },
    ]);
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

  const importFile = async (): Promise<void> => {
    const path = await window.logixzen?.dialog.openFile({
      title: "Open progress export",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (path === null || path === undefined) return;
    try {
      const content = await window.logixzen?.files.readText(path);
      if (typeof content !== "string") return;
      const result = importProgress(content);
      setImportMessage({ ok: result.ok, text: result.message });
    } catch (error) {
      setImportMessage({ ok: false, text: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <PageShell
      title="Progress"
      subtitle={`${solved}/${questionTotal || "—"} solved · ${totalPoints} points`}
      actions={
        <>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => void importFile()}>
            Import
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => void exportFile()}>
            <Download className="size-3.5" /> Export
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all progress?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes solved history, points, streaks and badges on this machine.
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
      <div className="mx-auto max-w-4xl space-y-5 px-5 py-6">
        {importMessage ? (
          <p className={cn("border px-3 py-2 text-[12px]", importMessage.ok ? "border-success/40 bg-success/5 text-success" : "border-error/40 bg-error/5 text-error")}>
            {importMessage.text}
          </p>
        ) : null}

        <div className="grid grid-cols-4 gap-2">
          <Stat label="Completion" value={`${completion}%`} icon={<Target className="size-3.5" />} />
          <Stat label="Solved" value={String(solved)} icon={<TrendingUp className="size-3.5" />} />
          <Stat label="Streak" value={`${streak.currentStreak}d`} icon={<Flame className="size-3.5" />} />
          <Stat label="Best time" value={bestTime === null ? "—" : `${(bestTime / 1000).toFixed(1)}s`} icon={<Trophy className="size-3.5" />} />
        </div>

        <section className="border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="section-label">Activity</span>
            <span className="numeric text-[10.5px] text-muted-dim">
              longest streak {streak.longestStreak}d
            </span>
          </div>
          <div className="flex flex-wrap gap-[3px]">
            {heatmap.map((cell) => (
              <span
                key={cell.date}
                title={cell.date === "" ? "No data" : `${cell.date}: ${cell.count} solved`}
                className={cn("size-[11px] border border-border/60", cell.level === 0 && "bg-surface-alt", cell.level === 1 && "bg-primary/25", cell.level === 2 && "bg-primary/50", cell.level === 3 && "bg-primary/75", cell.level === 4 && "bg-primary")}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[9.5px] text-muted-dim">
            <span>less</span>
            <span className="size-[10px] bg-surface-alt border border-border/60" />
            <span className="size-[10px] bg-primary/25" />
            <span className="size-[10px] bg-primary/50" />
            <span className="size-[10px] bg-primary/75" />
            <span className="size-[10px] bg-primary" />
            <span>more</span>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <Award className="size-3.5 text-warning" />
            <span className="section-label">Badges</span>
            <span className="numeric text-[10.5px] text-muted-dim">
              {badges.earned.size}/{BADGE_DEFINITIONS.length}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {BADGE_DEFINITIONS.map((badge) => {
              const earned = badges.earned.has(badge.id);
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "flex flex-col items-center gap-1.5 border p-3 text-center transition-colors",
                    earned ? "border-warning/40 bg-warning/5" : "border-border bg-surface-alt/50 opacity-60",
                  )}
                >
                  <Award className={cn("size-5", earned ? "text-warning" : "text-muted-dim")} />
                  <span className="text-[11.5px] font-semibold">{badge.title}</span>
                  <span className="text-[10px] leading-tight text-muted-dim">{badge.description}</span>
                  {earned ? (
                    <span className="numeric text-[9px] text-muted-dim">
                      {new Date(badges.earned.get(badge.id)?.timestamp ?? 0).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }): React.ReactElement {
  return (
    <div className="border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-dim">
        {icon}
        <span className="section-label">{label}</span>
      </div>
      <div className="numeric mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function buildHeatmap(activity: Map<string, number>): Array<{ date: string; count: number; level: number }> {
  const cells: Array<{ date: string; count: number; level: number }> = [];
  const days = 26 * 7;
  const today = new Date();
  const startOffset = today.getDay();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today.getTime() - (index - (6 - startOffset)) * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    if (date > today) {
      cells.push({ date: "", count: 0, level: 0 });
      continue;
    }
    const count = activity.get(key) ?? 0;
    const level = count === 0 ? 0 : count < 2 ? 1 : count < 4 ? 2 : count < 8 ? 3 : 4;
    cells.push({ date: key, count, level });
  }
  return cells;
}
