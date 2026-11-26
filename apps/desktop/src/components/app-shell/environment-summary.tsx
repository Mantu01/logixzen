"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-chip";
import { FEATURE_FLAGS, type PlatformSnapshot } from "@/shared/engines";
import { formatBytes } from "@/shared/format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface EnvironmentSummaryProps {
  snapshot: PlatformSnapshot | null;
  onRefresh: () => Promise<void>;
  loading?: boolean;
}

const OS_NAMES: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
};

export function EnvironmentSummary({
  snapshot,
  onRefresh,
  loading = false,
}: EnvironmentSummaryProps): React.ReactElement {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const dockerState =
    snapshot?.containerReadiness?.find((runtime) => runtime.runtime === "docker")
      ?.state ?? "unknown";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-surface px-3 py-1.5 text-[11px]">
      <dl className="flex flex-wrap items-center divide-x divide-border">
        <Fact
          label="OS"
          value={
            snapshot
              ? `${OS_NAMES[snapshot.osFamily] ?? snapshot.osFamily} ${snapshot.arch}`
              : "Detecting"
          }
        />
        <Fact
          label="RAM"
          value={
            snapshot?.totalMemoryBytes
              ? formatBytes(snapshot.totalMemoryBytes)
              : "Detecting"
          }
        />
        <Fact
          label="Disk"
          value={
            snapshot?.dataDisk.known
              ? `${formatBytes(snapshot.dataDisk.value.freeBytes)} free`
              : "Unknown"
          }
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2.5">
              <StatusDot
                tone={
                  FEATURE_FLAGS.docker && dockerState === "ready"
                    ? "success"
                    : "neutral"
                }
              />
              <span className="text-muted-dim">Docker</span>
              <span className="font-mono text-foreground">
                {FEATURE_FLAGS.docker ? dockerState : "Coming Soon"}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {FEATURE_FLAGS.docker
              ? `Container runtime status: ${dockerState}`
              : "Docker-based database sandboxes are coming in a future update"}
          </TooltipContent>
        </Tooltip>
      </dl>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={loading || refreshing}
            className="h-6 gap-1.5 px-1.5 text-[10.5px] text-muted-dim hover:text-foreground"
          >
            <RefreshCw
              className={cn(
                "size-3",
                (loading || refreshing) && "animate-spin",
              )}
            />
            Re-check
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Refresh detected host OS, memory, disk space, and runtime status
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5 px-2.5 first:pl-0">
      <dt className="text-muted-dim">{label}</dt>
      <dd className="font-mono text-foreground">{value}</dd>
    </div>
  );
}
