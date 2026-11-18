"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCw,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EngineOptionId, Job, ProgressEvent } from "@/shared/engines";
import { cn } from "@/lib/utils";

interface JobProgressProps {
  optionIds: string[];
  onComplete: () => void;
  onCancelAll: () => void;
}

export function JobProgress({
  optionIds,
  onComplete,
  onCancelAll,
}: JobProgressProps): React.ReactElement {
  const [currentOptionIndex, setCurrentOptionIndex] = useState(0);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [currentEvent, setCurrentEvent] = useState<ProgressEvent | null>(null);
  const [confirmingIrreversible, setConfirmingIrreversible] = useState(false);
  const [showLogTail, setShowLogTail] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);

  const activeOptionId = optionIds[currentOptionIndex];

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  useEffect(() => {
    const bridge = window.logixzen?.setup;
    if (!bridge) return;

    const unsubscribe = bridge.subscribeProgress((evt: ProgressEvent) => {
      setCurrentEvent(evt);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (
      !activeJob ||
      activeJob.state === "succeeded" ||
      activeJob.state === "failed" ||
      activeJob.state === "cancelled"
    ) {
      return;
    }

    const interval = setInterval(async () => {
      const bridge = window.logixzen?.setup;
      if (!bridge) return;
      try {
        const res = await bridge.getJob(activeJob.id);
        if (res.ok && res.data) {
          setActiveJob(res.data);
          if (res.data.state === "succeeded") {
            if (currentOptionIndex + 1 < optionIds.length) {
              setCurrentOptionIndex((prev) => prev + 1);
            } else {
              onComplete();
            }
          } else if (res.data.state === "failed") {
            setErrorDetails(
              res.data.failure?.detail ??
                res.data.failure?.cause ??
                "Operation failed.",
            );
          }
        }
      } catch {}
    }, 300);

    return () => clearInterval(interval);
  }, [activeJob, currentOptionIndex, optionIds.length, onComplete]);

  useEffect(() => {
    if (!activeOptionId || isCancelled) return;

    let mounted = true;
    const start = async () => {
      const bridge = window.logixzen?.setup;
      if (!bridge) return;

      try {
        const res = await bridge.startJob({
          optionId: activeOptionId as EngineOptionId,
          kind: activeOptionId === "sqlite" ? "activate" : "install",
        });
        if (mounted && res.ok && res.data) {
          setActiveJob(res.data);
        }
      } catch (err) {
        if (mounted) {
          setErrorDetails(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void start();
    return () => {
      mounted = false;
    };
  }, [activeOptionId, isCancelled]);

  const handleCancel = async () => {
    if (!activeJob) {
      setIsCancelled(true);
      onCancelAll();
      return;
    }

    const currentStage = activeJob.stages[activeJob.currentStageIndex];
    if (currentStage?.irreversible && !confirmingIrreversible) {
      setConfirmingIrreversible(true);
      return;
    }

    const bridge = window.logixzen?.setup;
    if (bridge) {
      if (confirmingIrreversible) {
        await bridge.confirmIrreversible(activeJob.id, false);
      }
      await bridge.cancelJob(activeJob.id);
    }
    setIsCancelled(true);
    onCancelAll();
  };

  const handleRetry = async () => {
    setErrorDetails(null);
    setConfirmingIrreversible(false);
    if (!activeOptionId) return;
    const bridge = window.logixzen?.setup;
    if (!bridge) return;
    const res = await bridge.startJob({
      optionId: activeOptionId as EngineOptionId,
      kind: activeOptionId === "sqlite" ? "activate" : "install",
    });
    if (res.ok && res.data) {
      setActiveJob(res.data);
    }
  };

  const handleManualRecheck = async () => {
    if (!activeJob) return;
    const bridge = window.logixzen?.setup;
    if (bridge) {
      await bridge.checkWaitingJob(activeJob.id);
    }
  };

  const isDeterminate = currentEvent?.measure.determinate ?? false;
  const progressPercent =
    isDeterminate && currentEvent?.measure.determinate
      ? currentEvent.measure.percent
      : null;
  const bytesDone =
    isDeterminate && currentEvent?.measure.determinate
      ? currentEvent.measure.bytesDone
      : null;
  const bytesTotal =
    isDeterminate && currentEvent?.measure.determinate
      ? currentEvent.measure.bytesTotal
      : null;

  return (
    <div className="space-y-4 max-w-2xl mx-auto text-[11.5px]">
      <div className="border border-border bg-surface p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[13.5px] font-semibold text-foreground">
              Setting up {activeOptionId} ({currentOptionIndex + 1} of{" "}
              {optionIds.length})
            </h2>
            <p className="mt-1 text-muted text-[11.5px]">
              {currentEvent?.activity ??
                activeJob?.stages[activeJob?.currentStageIndex ?? 0]?.label ??
                "Initializing setup process..."}
            </p>
          </div>

          <span className="font-mono text-[11px] text-muted-dim">
            {activeJob?.elapsedMs
              ? `${Math.round(activeJob.elapsedMs / 1000)}s`
              : "0s"}
          </span>
        </div>

        <div className="space-y-1.5">
          <div
            role="progressbar"
            aria-valuenow={progressPercent ?? undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden bg-surface-alt border border-border"
          >
            {isDeterminate && progressPercent !== null ? (
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${progressPercent}%` }}
              />
            ) : (
              <div className="h-full w-1/3 bg-primary animate-pulse" />
            )}
          </div>

          {isDeterminate && bytesDone !== null && bytesTotal !== null ? (
            <div className="flex justify-between text-[10px] text-muted-dim font-mono">
              <span>
                {formatBytes(bytesDone)} of {formatBytes(bytesTotal)}
              </span>
              <span>{progressPercent}%</span>
            </div>
          ) : null}
        </div>

        {confirmingIrreversible ? (
          <div className="border border-warning/40 bg-warning/10 p-3 space-y-2 text-warning">
            <div className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-3.5" />
              <span>Confirm Operation Cancellation</span>
            </div>
            <p className="text-[11px] text-foreground leading-relaxed">
              This stage is modifying persistent database state. Cancelling now
              will roll back incomplete changes and leave the engine
              unconfigured. Are you sure?
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                className="rounded-none h-7 text-[11px]"
              >
                Yes, Stop Installation
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmingIrreversible(false)}
                className="rounded-none h-7 text-[11px] border-border"
              >
                Continue Setup
              </Button>
            </div>
          </div>
        ) : null}

        {activeJob?.state === "waiting-for-user" ? (
          <div className="border border-primary/40 bg-primary/10 p-3 space-y-2 text-primary">
            <div className="flex items-center gap-1.5 font-medium">
              <Clock className="size-3.5" />
              <span>User Action Required</span>
            </div>
            <p className="text-[11px] text-foreground leading-relaxed">
              {activeJob.waitingAction ??
                "Complete the external setup task and click Re-check to continue."}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRecheck}
                className="rounded-none h-7 text-[11px] border-primary/50 text-foreground"
              >
                <RotateCw className="size-3 mr-1.5" />
                Re-check Readiness
              </Button>
            </div>
          </div>
        ) : null}

        {activeJob?.state === "failed" ? (
          <div className="border border-destructive/40 bg-destructive/10 p-3.5 space-y-3">
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-[12.5px]">
                  {activeJob.failure?.cause ?? "Setup failed."}
                </h4>
                <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                  You can retry this step, review technical diagnostics, or
                  return to engine selection.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleRetry}
                className="rounded-none h-7 text-[11px]"
              >
                <RotateCw className="size-3 mr-1.5" />
                Retry Setup
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogTail((prev) => !prev)}
                className="rounded-none h-7 text-[11px] border-border"
              >
                {showLogTail ? "Hide Details" : "View Technical Details"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelAll}
                className="rounded-none h-7 text-[11px] text-muted-dim"
              >
                Cancel
              </Button>
            </div>

            {showLogTail && errorDetails ? (
              <pre className="mt-2 p-2 border border-border bg-background text-[10px] font-mono text-muted overflow-x-auto whitespace-pre-wrap max-h-36">
                {errorDetails}
              </pre>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-border pt-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-dim block mb-2">
            Execution Stages
          </span>
          <div className="space-y-1.5">
            {activeJob?.stages.map((stage, idx) => {
              const isActive =
                activeJob.currentStageIndex === idx &&
                activeJob.state === "running";
              const isPast =
                activeJob.currentStageIndex > idx ||
                activeJob.state === "succeeded";
              const isFailed =
                activeJob.currentStageIndex === idx &&
                activeJob.state === "failed";
              const isWaiting =
                activeJob.currentStageIndex === idx &&
                activeJob.state === "waiting-for-user";

              return (
                <div
                  key={stage.id}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-1.5 border text-[11px] transition-colors",
                    isActive
                      ? "border-primary/40 bg-surface-alt font-medium text-foreground"
                      : isPast
                        ? "border-border/40 bg-surface text-muted"
                        : isFailed
                          ? "border-destructive/40 bg-destructive/5 text-destructive"
                          : "border-transparent text-muted-dim",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isPast ? (
                      <CheckCircle2 className="size-3.5 text-success shrink-0" />
                    ) : isFailed ? (
                      <XCircle className="size-3.5 text-destructive shrink-0" />
                    ) : isWaiting ? (
                      <Clock className="size-3.5 text-warning shrink-0" />
                    ) : (
                      <div
                        className={cn(
                          "size-2 rounded-full shrink-0",
                          isActive ? "bg-primary animate-ping" : "bg-border",
                        )}
                      />
                    )}
                    <span>{stage.label}</span>
                  </div>

                  {isActive ? (
                    <span className="text-[10px] text-primary uppercase tracking-wider font-mono">
                      Running
                    </span>
                  ) : isPast ? (
                    <span className="text-[10px] text-success uppercase tracking-wider font-mono">
                      Done
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        {activeJob?.state !== "succeeded" && activeJob?.state !== "failed" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="rounded-none border-border h-8 text-[11px] text-muted-dim hover:text-destructive"
          >
            Cancel Setup
          </Button>
        ) : null}
      </div>
    </div>
  );
}
