"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCw,
  XCircle,
} from "lucide-react";
import type { Job } from "@/shared/engines";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MaintenanceProgressProps {
  job: Job;
  onCancel: () => Promise<void>;
  onDismiss: () => Promise<void>;
  onCheckWaiting?: () => void;
  onConfirmIrreversible?: (proceed: boolean) => void;
  onRetry?: () => void;
}

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

  const isFailed = job.state === "failed";
  const isSucceeded = job.state === "succeeded";
  const isCancelled = job.state === "cancelled";
  const isWaiting = job.state === "waiting-for-user";
  const isRunning = job.state === "running" || job.state === "queued";

  const currentStage = job.stages[job.currentStageIndex];
  const downloadMeasure = job.measurements?.download;
  const isDeterminate = downloadMeasure && downloadMeasure.determinate;

  const handleCancelClick = async (): Promise<void> => {
    if (currentStage?.irreversible && !confirmingCancel) {
      setConfirmingCancel(true);
      return;
    }
    await onCancel();
    setConfirmingCancel(false);
  };

  return (
    <div className="space-y-4 text-[12px]">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-foreground font-medium">
            {isSucceeded
              ? "Operation Completed"
              : isFailed
                ? "Operation Failed"
                : isCancelled
                  ? "Operation Cancelled"
                  : isWaiting
                    ? "Action Required"
                    : (currentStage?.label ?? "Processing...")}
          </span>
          <span className="text-muted-dim">
            {isDeterminate ? `${Math.round(downloadMeasure.percent)}%` : ""}
          </span>
        </div>

        <div className="relative h-1.5 w-full overflow-hidden bg-surface-alt">
          {isDeterminate ? (
            <div
              className="h-full bg-primary transition-all duration-150"
              style={{
                width: `${Math.min(100, Math.max(0, downloadMeasure.percent))}%`,
              }}
            />
          ) : isRunning ? (
            <div className="h-full w-1/3 bg-primary animate-pulse" />
          ) : isSucceeded ? (
            <div className="h-full w-full bg-success" />
          ) : isFailed ? (
            <div className="h-full w-full bg-destructive" />
          ) : (
            <div className="h-full w-full bg-muted-dim" />
          )}
        </div>
      </div>

      <div className="border border-border divide-y divide-border bg-surface-alt/20 font-mono text-[11px]">
        {job.stages.map((stage, idx) => {
          const isCurrent = idx === job.currentStageIndex && isRunning;
          const isDone =
            stage.status === "succeeded" || idx < job.currentStageIndex;
          const isStageFailed = stage.status === "failed";

          return (
            <div
              key={stage.id}
              className={cn(
                "flex items-center justify-between py-2 px-3",
                isCurrent && "bg-surface-alt/60",
              )}
            >
              <div className="flex items-center gap-2">
                {isDone ? (
                  <CheckCircle2 className="size-3.5 text-success shrink-0" />
                ) : isStageFailed ? (
                  <XCircle className="size-3.5 text-destructive shrink-0" />
                ) : isCurrent ? (
                  <RotateCw className="size-3.5 text-primary animate-spin shrink-0" />
                ) : (
                  <Clock className="size-3.5 text-muted-dim shrink-0" />
                )}
                <span
                  className={cn(
                    isDone
                      ? "text-muted"
                      : isCurrent
                        ? "text-foreground font-semibold"
                        : isStageFailed
                          ? "text-destructive font-semibold"
                          : "text-muted-dim",
                  )}
                >
                  {stage.label}
                </span>
              </div>

              <span className="text-[10px] uppercase text-muted-dim">
                {isDone
                  ? "Done"
                  : isCurrent
                    ? "Active"
                    : isStageFailed
                      ? "Failed"
                      : "Pending"}
              </span>
            </div>
          );
        })}
      </div>

      {isWaiting ? (
        <div className="border border-warning/40 bg-warning/10 p-3.5 text-[11.5px] space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-foreground">
                External Action Required
              </div>
              <p className="mt-1 text-muted text-[11px] whitespace-pre-wrap">
                {job.waitingAction ??
                  "Complete the necessary setup step outside LogixZen to proceed."}
              </p>
            </div>
          </div>
          {onCheckWaiting ? (
            <div className="pt-1">
              <Button
                type="button"
                size="sm"
                onClick={onCheckWaiting}
                className="h-7 text-[11px]"
              >
                Check Again & Resume
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {isFailed && job.failure ? (
        <div className="border border-destructive/40 bg-destructive/10 p-3.5 text-[11.5px] space-y-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-destructive">
                {job.failure.cause}
              </div>
              {showTechnicalDetails && job.failure.detail ? (
                <div className="mt-2 border border-destructive/30 bg-black/60 p-2 font-mono text-[10.5px] text-destructive-foreground whitespace-pre-wrap">
                  {job.failure.detail}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {onRetry ? (
              <Button
                type="button"
                size="sm"
                onClick={onRetry}
                className="h-7 text-[11px]"
              >
                Retry Operation
              </Button>
            ) : null}
            {job.failure.detail ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTechnicalDetails((prev) => !prev)}
                className="border-destructive/40 h-7 text-[11px]"
              >
                {showTechnicalDetails
                  ? "Hide Technical Details"
                  : "View Technical Details"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onDismiss()}
              className="border-border h-7 text-[11px]"
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between pt-2">
        {confirmingCancel ? (
          <div className="flex items-center gap-2 border border-warning/40 bg-warning/10 p-2 w-full justify-between">
            <span className="text-[11px] text-warning">
              This stage is irreversible. Cancel anyway?
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (onConfirmIrreversible) onConfirmIrreversible(false);
                  void handleCancelClick();
                }}
                className="h-6.5 px-2 text-[10.5px]"
              >
                Yes, Stop
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmingCancel(false)}
                className="border-border h-6.5 px-2 text-[10.5px]"
              >
                Continue
              </Button>
            </div>
          </div>
        ) : isRunning ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCancelClick()}
            className="border-border h-7 text-[11px] text-muted hover:text-foreground"
          >
            Cancel Job
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onDismiss()}
            className="border-border h-7 text-[11px]"
          >
            Close Progress
          </Button>
        )}
      </div>
    </div>
  );
}
