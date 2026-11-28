"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import type { Job } from "@/shared/engines";
import { Button } from "@/components/ui/button";
import { JobProgressBar, JobStageList } from "@/components/jobs/job-stages";

interface MaintenanceProgressProps {
  job: Job;
  onCancel: () => Promise<void>;
  onDismiss: () => Promise<void>;
  onCheckWaiting?: () => void;
  onConfirmIrreversible?: (proceed: boolean) => void;
  onRetry?: () => void;
}

const STATE_TITLES: Record<string, string> = {
  succeeded: "Operation completed",
  failed: "Operation failed",
  cancelled: "Operation cancelled",
  interrupted: "Operation interrupted",
  "waiting-for-user": "Action required",
};

export function MaintenanceProgress({
  job,
  onCancel,
  onDismiss,
  onCheckWaiting,
  onConfirmIrreversible,
  onRetry,
}: MaintenanceProgressProps): React.ReactElement {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const currentStage = job.stages[job.currentStageIndex];
  const isRunning = job.state === "running" || job.state === "queued";
  const download = job.measurements.download;
  const percent =
    download?.determinate === true ? Math.round(download.percent) : null;

  const handleCancelClick = async (): Promise<void> => {
    if (currentStage?.irreversible && !confirmingCancel) {
      setConfirmingCancel(true);
      return;
    }
    await onCancel();
    setConfirmingCancel(false);
  };

  return (
    <div className="flex flex-col gap-3 text-[11.5px]">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between font-mono text-[10.5px]">
          <span className="font-medium text-foreground">
            {STATE_TITLES[job.state] ?? currentStage?.label ?? "Processing"}
          </span>
          {percent !== null ? (
            <span className="numeric text-muted-dim">{percent}%</span>
          ) : null}
        </div>
        <JobProgressBar job={job} />
      </div>

      <JobStageList job={job} />

      {job.state === "waiting-for-user" ? (
        <div className="flex flex-col gap-2 border border-warning/40 bg-warning/10 p-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <div className="min-w-0">
              <div className="font-medium text-foreground">
                External action required
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-muted">
                {job.waitingAction ??
                  "Complete the step outside LogixZen, then check again."}
              </p>
            </div>
          </div>
          {onCheckWaiting ? (
            <Button
              type="button"
              size="sm"
              onClick={onCheckWaiting}
              className="h-7 px-2.5 text-[11px]"
            >
              Check again
            </Button>
          ) : null}
        </div>
      ) : null}

      {job.state === "failed" && job.failure ? (
        <div className="flex flex-col gap-2.5 border border-destructive/40 bg-destructive/10 p-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            <div className="min-w-0">
              <div className="font-medium text-destructive">
                {job.failure.cause}
              </div>
              {showTechnicalDetails && job.failure.detail ? (
                <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap border border-destructive/30 bg-background p-2 font-mono text-[10.5px] text-muted">
                  {job.failure.detail}
                </pre>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {onRetry ? (
              <Button
                type="button"
                size="sm"
                onClick={onRetry}
                className="h-7 px-2.5 text-[11px]"
              >
                Retry
              </Button>
            ) : null}
            {job.failure.detail ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTechnicalDetails((prev) => !prev)}
                className="h-7 border-border px-2 text-[11px]"
              >
                {showTechnicalDetails ? "Hide details" : "Details"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onDismiss()}
              className="h-7 border-border px-2 text-[11px]"
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        {confirmingCancel ? (
          <div className="flex w-full items-center justify-between gap-2 border border-warning/40 bg-warning/10 px-2 py-1.5">
            <span className="text-[11px] text-warning">
              This stage is irreversible. Cancel anyway?
            </span>
            <span className="flex items-center gap-1">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  onConfirmIrreversible?.(true);
                  setConfirmingCancel(false);
                }}
                className="h-6 px-2 text-[10.5px]"
              >
                Stop
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onConfirmIrreversible?.(false);
                  setConfirmingCancel(false);
                }}
                className="h-6 border-border px-2 text-[10.5px]"
              >
                Continue
              </Button>
            </span>
          </div>
        ) : isRunning ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCancelClick()}
            className="h-7 border-border px-2 text-[11px]"
          >
            Cancel job
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onDismiss()}
            className="h-7 border-border px-2 text-[11px]"
          >
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
