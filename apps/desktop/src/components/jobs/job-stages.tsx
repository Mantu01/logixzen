import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import type { Job } from "@/shared/engines";
import { cn } from "@/lib/utils";

type StageVisual = "done" | "active" | "failed" | "waiting" | "pending";

function stageVisual(job: Job, index: number): StageVisual {
  const stage = job.stages[index];
  if (stage?.status === "failed" || (job.state === "failed" && index === job.currentStageIndex)) {
    return "failed";
  }
  if (job.state === "succeeded" || stage?.status === "succeeded" || index < job.currentStageIndex) {
    return "done";
  }
  if (index === job.currentStageIndex) {
    if (job.state === "waiting-for-user") return "waiting";
    if (job.state === "running" || job.state === "queued") return "active";
  }
  return "pending";
}

const STAGE_CLASSES: Record<StageVisual, string> = {
  done: "text-muted",
  active: "bg-surface-alt font-medium text-foreground",
  failed: "bg-destructive/5 text-destructive",
  waiting: "text-warning",
  pending: "text-muted-dim",
};

const STAGE_LABELS: Record<StageVisual, string> = {
  done: "Done",
  active: "Running",
  failed: "Failed",
  waiting: "Waiting",
  pending: "Pending",
};

export function JobStageList({ job }: { job: Job }): React.ReactElement {
  return (
    <ol className="divide-y divide-border border border-border font-mono text-[10.5px]">
      {job.stages.map((stage, index) => {
        const visual = stageVisual(job, index);
        return (
          <li
            key={stage.id}
            className={cn(
              "flex items-center justify-between gap-2 px-2.5 py-1.5",
              STAGE_CLASSES[visual],
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <StageIcon visual={visual} />
              <span className="truncate">{stage.label}</span>
            </span>
            <span className="shrink-0 uppercase tracking-wider text-[9.5px]">
              {STAGE_LABELS[visual]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StageIcon({ visual }: { visual: StageVisual }): React.ReactElement {
  if (visual === "done") {
    return <CheckCircle2 className="size-3 shrink-0 text-success" />;
  }
  if (visual === "failed") {
    return <XCircle className="size-3 shrink-0 text-destructive" />;
  }
  if (visual === "waiting") {
    return <Clock className="size-3 shrink-0 text-warning" />;
  }
  if (visual === "active") {
    return <Loader2 className="size-3 shrink-0 animate-spin text-primary" />;
  }
  return <span className="size-3 shrink-0" />;
}

export function JobProgressBar({ job }: { job: Job }): React.ReactElement {
  const download = job.measurements.download;
  const determinate = download?.determinate === true;
  const percent = determinate ? Math.min(100, Math.max(0, download.percent)) : 0;
  const running = job.state === "running" || job.state === "queued";

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={determinate ? Math.round(percent) : undefined}
      className="h-1.5 w-full overflow-hidden border border-border bg-surface-alt"
    >
      {determinate ? (
        <div
          className="h-full bg-primary transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
      ) : running ? (
        <div className="h-full w-1/3 animate-pulse bg-primary" />
      ) : job.state === "succeeded" ? (
        <div className="h-full w-full bg-success" />
      ) : job.state === "failed" ? (
        <div className="h-full w-full bg-destructive" />
      ) : (
        <div className="h-full w-full bg-border" />
      )}
    </div>
  );
}
