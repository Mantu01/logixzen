"use client";

import {
  ArrowRightLeft,
  HardDrive,
  Info,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Square,
  Trash2,
} from "lucide-react";
import type {
  EngineCatalogEntry,
  EngineOptionId,
  EngineStorageUsage,
  InstallationRecord,
} from "@/shared/engines";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app-shell/panel";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import { formatBytes } from "@/shared/format";
import { methodLabel, statusLabel } from "@/lib/engine-status";
import { cn } from "@/lib/utils";

interface InstalledEnginesTableProps {
  records: InstallationRecord[];
  catalog: EngineCatalogEntry[];
  activeOptionId: EngineOptionId | null;
  storageUsage: Record<string, EngineStorageUsage>;
  isStorageLoading?: boolean;
  onRefreshStorage: () => Promise<void>;
  onSwitch: (optionId: EngineOptionId) => Promise<void>;
  onVerify: (optionId: EngineOptionId) => Promise<void>;
  onStartStop: (
    optionId: EngineOptionId,
    action: "start" | "stop",
  ) => Promise<void>;
  onOpenResetConfirm: (record: InstallationRecord) => void;
  onOpenUninstallConfirm: (record: InstallationRecord) => void;
  onOpenDeleteDataConfirm: (record: InstallationRecord) => void;
  onOpenDetails: (record: InstallationRecord) => void;
  isActionExecuting?: boolean;
}

function statusTone(status: InstallationRecord["status"]): StatusTone {
  if (status === "ready") return "success";
  if (status === "needs-repair" || status === "failed") return "warning";
  if (status === "stopped") return "neutral";
  return "info";
}

export function InstalledEnginesTable({
  records,
  catalog,
  activeOptionId,
  storageUsage,
  isStorageLoading = false,
  onRefreshStorage,
  onSwitch,
  onVerify,
  onStartStop,
  onOpenResetConfirm,
  onOpenUninstallConfirm,
  onOpenDeleteDataConfirm,
  onOpenDetails,
  isActionExecuting = false,
}: InstalledEnginesTableProps): React.ReactElement {
  return (
    <Panel
      title="Installed engines"
      description="Operational state, storage footprint and maintenance actions."
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onRefreshStorage()}
          disabled={isStorageLoading}
          className="h-7 gap-1.5 border-border px-2 text-[11px]"
        >
          <HardDrive className={cn("size-3", isStorageLoading && "animate-pulse")} />
          Storage
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[11.5px]">
          <thead>
            <tr className="border-b border-border bg-surface-alt/60 font-mono text-[9.5px] uppercase tracking-wider text-muted-dim">
              <th className="px-3 py-1.5 font-medium">Engine</th>
              <th className="px-3 py-1.5 font-medium">Method</th>
              <th className="px-3 py-1.5 font-medium">Version</th>
              <th className="px-3 py-1.5 font-medium">Target</th>
              <th className="px-3 py-1.5 font-medium">Status</th>
              <th className="px-3 py-1.5 font-medium">Storage</th>
              <th className="px-3 py-1.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {records.map((record) => {
              const entry = catalog.find((item) => item.id === record.optionId);
              const isActive = record.optionId === activeOptionId;
              const isReady = record.status === "ready";
              const isStopped = record.status === "stopped";
              const storage = storageUsage[record.optionId];
              const supportsStartStop = entry?.capabilities.startStop ?? false;

              return (
                <tr key={record.optionId} className="hover:bg-surface-alt/40">
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">
                      {entry?.displayName ?? record.optionId}
                    </div>
                    <div className="font-mono text-[10px] text-muted-dim">
                      {record.optionId}
                    </div>
                  </td>

                  <td className="px-3 py-2 text-muted">
                    {methodLabel(record.method)}
                  </td>

                  <td className="px-3 py-2 font-mono text-muted">
                    {record.installedVersion ?? entry?.pin ?? "—"}
                  </td>

                  <td className="max-w-44 truncate px-3 py-2 font-mono text-muted-dim">
                    {record.port !== undefined
                      ? `127.0.0.1:${record.port}`
                      : (record.dataLocation ?? "—")}
                  </td>

                  <td className="px-3 py-2">
                    <StatusChip tone={statusTone(record.status)}>
                      {statusLabel(record.status)}
                    </StatusChip>
                  </td>

                  <td className="px-3 py-2 font-mono">
                    <div className="text-foreground">
                      {storage?.practiceBytes !== undefined
                        ? formatBytes(storage.practiceBytes)
                        : "—"}
                    </div>
                    <div className="text-[10px] text-muted-dim">
                      {storage?.dataBytes !== undefined
                        ? formatBytes(storage.dataBytes)
                        : "—"}
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {isActive ? (
                        <StatusChip tone="info">Active</StatusChip>
                      ) : isReady ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void onSwitch(record.optionId)}
                          disabled={isActionExecuting}
                          className="h-6 gap-1 border-border px-1.5 text-[10.5px]"
                        >
                          <ArrowRightLeft className="size-2.5" />
                          Switch
                        </Button>
                      ) : null}

                      {supportsStartStop ? (
                        isStopped ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void onStartStop(record.optionId, "start")
                            }
                            disabled={isActionExecuting}
                            className="h-6 gap-1 border-border px-1.5 text-[10.5px]"
                          >
                            <Play className="size-2.5" />
                            Start
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void onStartStop(record.optionId, "stop")
                            }
                            disabled={isActionExecuting}
                            className="h-6 gap-1 border-border px-1.5 text-[10.5px]"
                          >
                            <Square className="size-2.5" />
                            Stop
                          </Button>
                        )
                      ) : null}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void onVerify(record.optionId)}
                        disabled={isActionExecuting}
                        className="h-6 gap-1 border-border px-1.5 text-[10.5px]"
                      >
                        <RefreshCw className="size-2.5" />
                        Verify
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenResetConfirm(record)}
                        disabled={isActionExecuting}
                        className="h-6 gap-1 border-border px-1.5 text-[10.5px]"
                        title="Reset the practice environment"
                      >
                        <RotateCcw className="size-2.5" />
                        Reset
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onOpenDetails(record)}
                        className="text-muted hover:text-foreground"
                        aria-label={`Details for ${entry?.displayName ?? record.optionId}`}
                      >
                        <Info />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onOpenUninstallConfirm(record)}
                        disabled={isActionExecuting}
                        className="text-muted-dim hover:text-foreground"
                        aria-label={`Uninstall ${entry?.displayName ?? record.optionId}`}
                      >
                        <Trash2 />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onOpenDeleteDataConfirm(record)}
                        disabled={isActionExecuting}
                        className="text-destructive/70 hover:text-destructive"
                        aria-label={`Delete data for ${entry?.displayName ?? record.optionId}`}
                      >
                        <ShieldAlert />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
