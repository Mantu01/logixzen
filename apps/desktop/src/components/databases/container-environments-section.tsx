"use client";

import { Box, Play, RefreshCw, Square, Terminal } from "lucide-react";
import type {
  EngineCatalogEntry,
  EngineOptionId,
  InstallationRecord,
  PlatformSnapshot,
} from "@/shared/engines";
import { defaultContainerName } from "@/shared/engine-catalog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ContainerEnvironmentsSectionProps {
  catalog: EngineCatalogEntry[];
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

export function ContainerEnvironmentsSection({
  catalog,
  installedRecords,
  snapshot,
  onLifecycle,
  onRestart,
  onUpdateImage,
  onViewLogs,
  isActionExecuting = false,
}: ContainerEnvironmentsSectionProps): React.ReactElement | null {
  const containerOffers = catalog.filter((c) => c.method === "container");
  if (containerOffers.length === 0) return null;

  const dockerRuntime = snapshot?.containerReadiness?.find(
    (r) => r.runtime === "docker",
  );
  const dockerState = dockerRuntime?.state ?? "unknown";
  const dockerReady = dockerState === "ready";

  return (
    <div className="border border-border bg-surface text-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Box className="size-4 text-primary shrink-0" />
            <h2 className="text-[13px] font-semibold text-foreground">
              Container Environments
            </h2>
          </div>
          <p className="text-[11.5px] text-muted">
            Isolated local containers, loopback port bindings, persistent
            volumes, and runtime state.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-muted-dim uppercase text-[10px]">Runtime:</span>
          <span
            className={cn(
              "border px-1.5 py-0.5 text-[10px] uppercase font-semibold",
              dockerReady
                ? "border-success/30 bg-success/10 text-success"
                : "border-warning/30 bg-warning/10 text-warning",
            )}
          >
            Docker {dockerState}
          </span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {containerOffers.map((entry) => {
          const installed = installedRecords.find(
            (r) => r.optionId === entry.id,
          );
          const isInstalled = !!installed;
          const status = installed?.status ?? "not-installed";
          const isRunning = status === "ready";
          const isStopped = status === "stopped";
          const containerName =
            installed?.containerName ?? defaultContainerName(entry.id);
          const port = installed?.port ?? entry.container?.port ?? 1433;
          const volume = installed?.resources.volume ?? `${containerName}-data`;

          return (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-surface-alt/30 transition-colors"
            >
              <div className="space-y-1 max-w-xl font-mono text-[11px]">
                <div className="flex items-center gap-2 font-sans">
                  <span className="font-semibold text-foreground text-[12.5px]">
                    {entry.displayName}
                  </span>
                  <span
                    className={cn(
                      "border px-1.5 py-0.2 text-[9.5px] uppercase font-mono font-medium",
                      isRunning
                        ? "border-success/30 bg-success/10 text-success"
                        : isStopped
                          ? "border-border bg-surface-alt text-muted"
                          : "border-border bg-surface-alt/50 text-muted-dim",
                    )}
                  >
                    {status}
                  </span>
                </div>

                <div className="text-muted text-[10.5px]">
                  Container:{" "}
                  <span className="text-foreground">{containerName}</span>
                  {" · "}
                  Port:{" "}
                  <span className="text-foreground">127.0.0.1:{port}</span>
                </div>

                <div className="text-muted-dim text-[10px]">
                  Image: {entry.container?.image}:{entry.container?.tag}
                  {" · "}
                  Volume: {volume}
                </div>
              </div>

              {isInstalled ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isStopped ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void onLifecycle(entry.id, "start")}
                      disabled={isActionExecuting}
                      className="border-border h-7 text-[11px] gap-1 text-success hover:text-success"
                    >
                      <Play className="size-3" />
                      <span>Start</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void onLifecycle(entry.id, "stop")}
                      disabled={isActionExecuting}
                      className="border-border h-7 text-[11px] gap-1 text-warning hover:text-warning"
                    >
                      <Square className="size-3" />
                      <span>Stop</span>
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onRestart(entry.id)}
                    disabled={isActionExecuting}
                    className="border-border h-7 text-[11px] gap-1"
                  >
                    <RefreshCw className="size-3" />
                    <span>Restart</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onViewLogs(entry.id)}
                    className="border-border h-7 text-[11px] gap-1"
                  >
                    <Terminal className="size-3" />
                    <span>Logs</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void onUpdateImage(entry.id)}
                    disabled={isActionExecuting}
                    className="h-7 text-[11px] text-muted-dim hover:text-foreground"
                    title="Pull latest image and recreate container"
                  >
                    <span>Update Image</span>
                  </Button>
                </div>
              ) : (
                <span className="text-[11px] text-muted-dim font-mono">
                  Not provisioned
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
