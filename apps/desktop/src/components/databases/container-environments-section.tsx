"use client";

import Link from "next/link";
import { Play, RefreshCw, Square, Terminal } from "lucide-react";
import {
  FEATURE_FLAGS,
  type EngineOffer,
  type EngineOptionId,
  type InstallationRecord,
  type PlatformSnapshot,
} from "@/shared/engines";
import {
  defaultContainerName,
  defaultVolumeName,
} from "@/shared/engine-catalog";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app-shell/panel";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import { statusLabel } from "@/lib/engine-status";

interface ContainerEnvironmentsSectionProps {
  offers: EngineOffer[];
  installedRecords: InstallationRecord[];
  snapshot: PlatformSnapshot | null;
  onLifecycle: (
    optionId: EngineOptionId,
    action: "start" | "stop",
  ) => Promise<void>;
  onRestart: (optionId: EngineOptionId) => Promise<void>;
  onUpdateImage: (optionId: EngineOptionId) => Promise<void>;
  onViewLogs: (optionId: EngineOptionId) => void;
  isActionExecuting?: boolean;
}

function statusTone(status: InstallationRecord["status"]): StatusTone {
  if (status === "ready") return "success";
  if (status === "needs-repair" || status === "failed") return "warning";
  if (status === "stopped") return "neutral";
  return "info";
}

export function ContainerEnvironmentsSection({
  offers,
  installedRecords,
  snapshot,
  onLifecycle,
  onRestart,
  onUpdateImage,
  onViewLogs,
  isActionExecuting = false,
}: ContainerEnvironmentsSectionProps): React.ReactElement | null {
  if (offers.length === 0) return null;

  const dockerState =
    snapshot?.containerReadiness?.find((runtime) => runtime.runtime === "docker")
      ?.state ?? "unknown";
  const dockerEnabled = FEATURE_FLAGS.docker;

  return (
    <Panel
      title="Container environments"
      description={
        dockerEnabled
          ? "Loopback-only containers with persistent volumes."
          : "Containerized database engines are coming soon."
      }
      actions={
        dockerEnabled ? (
          <StatusChip>Docker: {dockerState}</StatusChip>
        ) : (
          <StatusChip tone="info">Coming Soon</StatusChip>
        )
      }
    >
      <ul className="divide-y divide-border">
        {offers.map(({ entry }) => {
          const installed = installedRecords.find(
            (record) => record.optionId === entry.id,
          );
          const status = installed?.status ?? "not-installed";
          const isStopped = status === "stopped";
          const containerName =
            installed?.containerName ?? defaultContainerName(entry.id);
          const volume =
            installed?.resources.volume ?? defaultVolumeName(entry.id);

          return (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 hover:bg-surface-alt/40"
            >
              <div className="min-w-0 font-mono text-[10.5px] text-muted-dim">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-sans text-[12px] font-semibold text-foreground">
                    {entry.displayName}
                  </span>
                  {dockerEnabled ? (
                    <StatusChip tone={statusTone(status)}>
                      {statusLabel(status)}
                    </StatusChip>
                  ) : (
                    <StatusChip tone="info">Coming Soon</StatusChip>
                  )}
                </div>
                <div className="mt-0.5 truncate">
                  {containerName}
                  {installed?.port !== undefined
                    ? ` · 127.0.0.1:${installed.port}`
                    : null}
                  {` · volume ${volume}`}
                </div>
                <div className="truncate text-[10px]">
                  {entry.container?.image}:{entry.container?.tag}
                </div>
              </div>

              {!dockerEnabled ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  className="h-7 cursor-not-allowed border-border px-2 text-[11px] opacity-60"
                >
                  Coming Soon
                </Button>
              ) : installed === undefined ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-7 border-border px-2 text-[11px]"
                >
                  <Link href={`/setup?engine=${entry.id}`}>Provision</Link>
                </Button>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void onLifecycle(entry.id, isStopped ? "start" : "stop")
                    }
                    disabled={isActionExecuting}
                    className="h-6 gap-1 border-border px-1.5 text-[10.5px]"
                  >
                    {isStopped ? (
                      <Play className="size-2.5" />
                    ) : (
                      <Square className="size-2.5" />
                    )}
                    {isStopped ? "Start" : "Stop"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onRestart(entry.id)}
                    disabled={isActionExecuting}
                    className="h-6 gap-1 border-border px-1.5 text-[10.5px]"
                  >
                    <RefreshCw className="size-2.5" />
                    Restart
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onViewLogs(entry.id)}
                    className="h-6 gap-1 border-border px-1.5 text-[10.5px]"
                  >
                    <Terminal className="size-2.5" />
                    Logs
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void onUpdateImage(entry.id)}
                    disabled={isActionExecuting}
                    className="h-6 px-1.5 text-[10.5px] text-muted-dim hover:text-foreground"
                  >
                    Update image
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
