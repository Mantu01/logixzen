"use client";

import Link from "next/link";
import { Box, Play, RefreshCw, Square, Terminal } from "lucide-react";
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
  const dockerState =
    snapshot?.containerReadiness?.find((runtime) => runtime.runtime === "docker")
      ?.state ?? "unknown";
  const dockerEnabled = FEATURE_FLAGS.docker;

  if (!dockerEnabled) {
    return (
      <Panel
        title="Container environments"
        description="Docker support for any database engine."
        actions={<StatusChip tone="info">Coming Soon</StatusChip>}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 px-3 py-3.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center border border-border bg-surface-alt text-primary">
              <Box className="size-3.5" />
            </span>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-foreground">
                Bring any database engine via Docker
              </div>
              <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-muted">
                Container orchestration will let you spin up or attach any SQL
                engine image you want with isolated storage, automatic port
                binding, and direct schema introspection.
              </p>
            </div>
          </div>
          <span className="shrink-0 font-mono text-[10.5px] text-muted-dim">
            Runtime: {dockerState}
          </span>
        </div>
      </Panel>
    );
  }

  if (offers.length === 0) return null;

  return (
    <Panel
      title="Container environments"
      description="Loopback-only containers with persistent volumes."
      actions={<StatusChip>Docker: {dockerState}</StatusChip>}
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
                  <StatusChip tone={statusTone(status)}>
                    {statusLabel(status)}
                  </StatusChip>
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

              {installed === undefined ? (
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
                    className="h-6 border-border px-1.5 text-[10.5px]"
                  >
                    {isStopped ? (
                      <Play data-icon="inline-start" />
                    ) : (
                      <Square data-icon="inline-start" />
                    )}
                    {isStopped ? "Start" : "Stop"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onRestart(entry.id)}
                    disabled={isActionExecuting}
                    className="h-6 border-border px-1.5 text-[10.5px]"
                  >
                    <RefreshCw data-icon="inline-start" />
                    Restart
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onViewLogs(entry.id)}
                    className="h-6 border-border px-1.5 text-[10.5px]"
                  >
                    <Terminal data-icon="inline-start" />
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
