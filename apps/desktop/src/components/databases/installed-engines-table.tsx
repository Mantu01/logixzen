"use client";

import {
  ArrowRightLeft,
  HardDrive,
  Info,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import type {
  EngineCatalogEntry,
  EngineOptionId,
  EngineStorageUsage,
  InstallationRecord,
} from "@/shared/engines";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/shared/format";
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
    <div className="border border-border bg-surface text-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3.5">
        <div>
          <h2 className="text-[13px] font-semibold text-foreground">
            Installed Database Engines
          </h2>
          <p className="text-[11.5px] text-muted">
            Configured engines, current operational state, storage footprints,
            and maintenance actions.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onRefreshStorage()}
          disabled={isStorageLoading}
          className="border-border h-7 text-[11px] gap-1.5"
        >
          <HardDrive
            className={cn("size-3", isStorageLoading && "animate-pulse")}
          />
          <span>
            {isStorageLoading
              ? "Computing storage..."
              : "Refresh Storage Usage"}
          </span>
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-alt/40 text-[10px] uppercase font-mono text-muted-dim">
              <th className="py-2 px-3 font-medium">Engine</th>
              <th className="py-2 px-3 font-medium">Method</th>
              <th className="py-2 px-3 font-medium">Version</th>
              <th className="py-2 px-3 font-medium">Status</th>
              <th className="py-2 px-3 font-medium">Storage</th>
              <th className="py-2 px-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono text-[11.5px]">
            {records.map((record) => {
              const entry = catalog.find((c) => c.id === record.optionId);
              const isActive = record.optionId === activeOptionId;
              const isReady = record.status === "ready";
              const isStopped = record.status === "stopped";
              const isNeedsRepair = record.status === "needs-repair";
              const storage = storageUsage[record.optionId];
              const supportsStartStop = entry?.capabilities?.startStop ?? false;

              return (
                <tr
                  key={record.optionId}
                  className="hover:bg-surface-alt/30 transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-foreground">
                      {entry?.displayName ?? record.optionId}
                    </div>
                    <div className="text-[10px] text-muted-dim">
                      {record.optionId}
                    </div>
                  </td>

                  <td className="py-2.5 px-3">
                    <span className="border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] uppercase text-muted">
                      {record.method}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-muted">
                    {record.installedVersion ?? entry?.pin ?? "Bundled"}
                  </td>

                  <td className="py-2.5 px-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                        isReady
                          ? "border-success/30 bg-success/10 text-success"
                          : isNeedsRepair
                            ? "border-warning/30 bg-warning/10 text-warning"
                            : isStopped
                              ? "border-border bg-surface-alt text-muted"
                              : "border-primary/30 bg-primary/10 text-primary",
                      )}
                    >
                      {record.status}
                    </span>
                  </td>

                  <td className="py-2.5 px-3">
                    <div className="text-foreground">
                      Practice:{" "}
                      {storage?.practiceBytes !== undefined
                        ? formatBytes(storage.practiceBytes)
                        : "—"}
                    </div>
                    <div className="text-[10.5px] text-muted-dim">
                      Total:{" "}
                      {storage?.dataBytes !== undefined
                        ? formatBytes(storage.dataBytes)
                        : "—"}
                    </div>
                  </td>

                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {isActive ? (
                        <span className="border border-primary/30 bg-primary/10 text-primary px-2 py-0.5 text-[10px] uppercase font-semibold">
                          Active
                        </span>
                      ) : isReady ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void onSwitch(record.optionId)}
                          disabled={isActionExecuting}
                          className="border-border h-6.5 px-2 text-[10.5px] gap-1"
                        >
                          <ArrowRightLeft className="size-2.5" />
                          <span>Switch</span>
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
                            className="border-border h-6.5 px-2 text-[10.5px] gap-1 text-success hover:text-success"
                          >
                            <Play className="size-2.5" />
                            <span>Start</span>
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
                            className="border-border h-6.5 px-2 text-[10.5px] gap-1 text-warning hover:text-warning"
                          >
                            <Square className="size-2.5" />
                            <span>Stop</span>
                          </Button>
                        )
                      ) : null}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void onVerify(record.optionId)}
                        disabled={isActionExecuting}
                        className="border-border h-6.5 px-2 text-[10.5px] gap-1"
                      >
                        <RefreshCw className="size-2.5" />
                        <span>Verify</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenResetConfirm(record)}
                        disabled={isActionExecuting}
                        className="border-border h-6.5 px-2 text-[10.5px] gap-1"
                        title="Reset practice database to canonical 373 records"
                      >
                        <RotateCcw className="size-2.5" />
                        <span>Reset DB</span>
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenDetails(record)}
                        className="h-6.5 px-1.5 text-[10.5px] text-muted hover:text-foreground"
                        title="View technical details"
                      >
                        <Info className="size-3" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenUninstallConfirm(record)}
                        disabled={isActionExecuting}
                        className="h-6.5 px-1.5 text-[10.5px] text-muted-dim hover:text-destructive"
                        title="Uninstall engine (keeps data)"
                      >
                        <Trash2 className="size-3" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenDeleteDataConfirm(record)}
                        disabled={isActionExecuting}
                        className="h-6.5 px-1.5 text-[10.5px] text-destructive/70 hover:text-destructive"
                        title="Permanently delete data"
                      >
                        <ShieldAlert className="size-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
