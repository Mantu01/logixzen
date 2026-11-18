"use client";

import { useState } from "react";
import { Cpu, HardDrive, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlatformSnapshot } from "@/shared/engines";
import { cn } from "@/lib/utils";

interface EnvironmentSummaryProps {
  snapshot: PlatformSnapshot | null;
  onRefresh: () => Promise<void>;
  loading?: boolean;
}

export function EnvironmentSummary({
  snapshot,
  onRefresh,
  loading = false,
}: EnvironmentSummaryProps): React.ReactElement {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const osLabel = snapshot
    ? `${snapshot.osFamily === "windows" ? "Windows" : snapshot.osFamily === "macos" ? "macOS" : "Linux"} (${snapshot.arch})`
    : "Detecting OS...";

  const ramLabel = snapshot?.totalMemoryBytes
    ? `${Math.round(snapshot.totalMemoryBytes / (1024 * 1024 * 1024))} GB RAM`
    : "Detecting RAM...";

  const diskLabel = snapshot?.dataDisk.known
    ? `${Math.round(snapshot.dataDisk.value.freeBytes / (1024 * 1024 * 1024))} GB free`
    : "Disk available";

  const dockerRuntime = snapshot?.containerReadiness?.find(
    (r) => r.runtime === "docker",
  );
  const dockerState = dockerRuntime?.state ?? "unknown";
  const dockerReady = dockerState === "ready";

  return (
    <div className="border border-border bg-surface p-3.5 text-[11.5px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <Cpu className="size-3.5 text-primary shrink-0" />
            <span>{osLabel}</span>
          </div>

          <div className="flex items-center gap-1.5 text-muted">
            <span>{ramLabel}</span>
          </div>

          <div className="flex items-center gap-1.5 text-muted">
            <HardDrive className="size-3.5 text-muted-dim shrink-0" />
            <span className="font-mono tabular-nums">{diskLabel}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "size-1.5 rounded-full shrink-0",
                dockerReady ? "bg-success" : "bg-muted-dim",
              )}
            />
            <span className="text-muted">
              Docker:{" "}
              <span className="font-medium text-foreground capitalize">
                {dockerState}
              </span>
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="h-7 text-[11px] gap-1.5 rounded-none border-border"
        >
          <RefreshCw
            className={cn("size-3", (loading || refreshing) && "animate-spin")}
          />
          <span>Re-check</span>
        </Button>
      </div>
    </div>
  );
}
