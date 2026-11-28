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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
          className="h-7 border-border px-2 text-[11px]"
        >
          <HardDrive
            data-icon="inline-start"
            className={cn(isStorageLoading && "animate-pulse")}
          />
          Recalculate storage
        </Button>
      }
    >
      <div className="w-full overflow-x-auto">
        <table className="w-full table-auto border-collapse text-left text-[11.5px]">
          <thead>
            <tr className="border-b border-border bg-surface-alt/70 font-mono text-[9.5px] uppercase tracking-wider text-muted-dim">
              <th className="px-3 py-2 font-medium">Engine</th>
              <th className="px-3 py-2 font-medium">Runtime</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Storage</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
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
              const targetText =
                record.port !== undefined
                  ? `127.0.0.1:${record.port}`
                  : (record.dataLocation ?? "—");

              return (
                <tr
                  key={record.optionId}
                  className={cn(
                    "transition-colors hover:bg-surface-alt/40",
                    isActive && "bg-primary/[0.03]",
                  )}
                >
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {entry?.displayName ?? record.optionId}
                      </span>
                      {isActive ? (
                        <StatusChip tone="info">Active</StatusChip>
                      ) : null}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-dim">
                      {record.optionId}
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                    <div className="text-foreground/90">
                      {methodLabel(record.method)}
                    </div>
                    <div className="numeric mt-0.5 font-mono text-[10px] text-muted-dim">
                      v{record.installedVersion ?? entry?.pin ?? "—"}
                    </div>
                  </td>

                  <td className="max-w-[180px] px-3 py-2.5 align-middle font-mono text-[11px] text-muted-dim">
                    {targetText !== "—" ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate">{targetText}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md break-all font-mono text-[11px]">
                          {record.port !== undefined && record.dataLocation
                            ? `127.0.0.1:${record.port} · ${record.dataLocation}`
                            : targetText}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                    <StatusChip tone={statusTone(record.status)}>
                      {statusLabel(record.status)}
                    </StatusChip>
                  </td>

                  <td className="numeric whitespace-nowrap px-3 py-2.5 align-middle font-mono">
                    <div className="flex items-baseline gap-1.5 text-[11px] text-foreground">
                      <span className="text-[9.5px] uppercase text-muted-dim">
                        DB
                      </span>
                      <span>
                        {storage?.practiceBytes !== undefined
                          ? formatBytes(storage.practiceBytes)
                          : "—"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-1.5 text-[10px] text-muted-dim">
                      <span className="text-[9px] uppercase">Total</span>
                      <span>
                        {storage?.dataBytes !== undefined
                          ? formatBytes(storage.dataBytes)
                          : "—"}
                      </span>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                    <div className="flex items-center justify-end gap-1">
                      {!isActive && isReady ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void onSwitch(record.optionId)}
                          disabled={isActionExecuting}
                          className="h-6 border-border px-1.5 text-[10.5px]"
                        >
                          <ArrowRightLeft data-icon="inline-start" />
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
                            className="h-6 border-border px-1.5 text-[10.5px]"
                          >
                            <Play data-icon="inline-start" />
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
                            className="h-6 border-border px-1.5 text-[10.5px]"
                          >
                            <Square data-icon="inline-start" />
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
                        className="h-6 border-border px-1.5 text-[10.5px]"
                      >
                        <RefreshCw data-icon="inline-start" />
                        Verify
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenResetConfirm(record)}
                        disabled={isActionExecuting}
                        className="h-6 border-border px-1.5 text-[10.5px]"
                      >
                        <RotateCcw data-icon="inline-start" />
                        Reset
                      </Button>

                      <div className="ml-0.5 flex items-center border-l border-border pl-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
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
                          </TooltipTrigger>
                          <TooltipContent>
                            Technical details & paths
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
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
                          </TooltipTrigger>
                          <TooltipContent>Uninstall engine</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => onOpenDeleteDataConfirm(record)}
                              disabled={isActionExecuting}
                              className="text-destructive/75 hover:text-destructive"
                              aria-label={`Delete data for ${entry?.displayName ?? record.optionId}`}
                            >
                              <ShieldAlert />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Delete all stored database files
                          </TooltipContent>
                        </Tooltip>
                      </div>
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
