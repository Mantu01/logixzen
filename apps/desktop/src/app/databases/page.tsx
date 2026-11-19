"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Database, Plus, RefreshCw } from "lucide-react";
import type {
  EngineCatalogEntry,
  EngineOffer,
  EngineOptionId,
  EngineStorageUsage,
  InstallationRecord,
  Job,
  PlatformSnapshot,
  ProgressEvent,
} from "@/shared/engines";
import { PageShell } from "@/components/app-shell/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EnvironmentSummary } from "@/components/app-shell/environment-summary";
import { MaintenanceProgress } from "@/components/databases/maintenance-progress";
import { ActiveConnectionCard } from "@/components/databases/active-connection-card";
import { InstalledEnginesTable } from "@/components/databases/installed-engines-table";
import { AvailableEnginesSection } from "@/components/databases/available-engines-section";
import { ContainerEnvironmentsSection } from "@/components/databases/container-environments-section";
import {
  ConfirmActionDialog,
  type ConfirmActionType,
} from "@/components/databases/confirm-action-dialog";
import { DeleteDataDialog } from "@/components/databases/delete-data-dialog";
import { EngineDetailsDialog } from "@/components/databases/engine-details-dialog";
import { ContainerLogsDialog } from "@/components/databases/container-logs-dialog";
import { useSqlStore } from "@/sql/useSqlStore";

export default function DatabasesPage(): React.ReactElement {
  const [snapshot, setSnapshot] = useState<PlatformSnapshot | null>(null);
  const [catalog, setCatalog] = useState<EngineCatalogEntry[]>([]);
  const [compatibility, setCompatibility] = useState<EngineOffer[]>([]);
  const [installations, setInstallations] = useState<InstallationRecord[]>([]);
  const [activeOptionId, setActiveOptionId] = useState<EngineOptionId | null>(
    null,
  );
  const [storageUsage, setStorageUsage] = useState<
    Record<string, EngineStorageUsage>
  >({});
  const [isStorageLoading, setIsStorageLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeJob, setActiveJob] = useState<Job | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: ConfirmActionType;
    record: InstallationRecord | null;
  }>({ open: false, type: "reset", record: null });

  const [deleteDataModal, setDeleteDataModal] = useState<{
    open: boolean;
    record: InstallationRecord | null;
  }>({ open: false, record: null });

  const [detailsModal, setDetailsModal] = useState<{
    open: boolean;
    record: InstallationRecord | null;
    entry: EngineCatalogEntry | null;
  }>({ open: false, record: null, entry: null });

  const [logsModal, setLogsModal] = useState<{
    open: boolean;
    optionId: EngineOptionId | null;
  }>({ open: false, optionId: null });

  const [isActionExecuting, setIsActionExecuting] = useState(false);

  const loadData = useCallback(async (): Promise<void> => {
    await Promise.resolve();
    if (typeof window === "undefined" || !window.logixzen?.setup) {
      setLoading(false);
      return;
    }

    try {
      const [snapRes, catRes, compRes, instRes, activeRes] = await Promise.all([
        window.logixzen.setup.snapshot(),
        window.logixzen.setup.catalog(),
        window.logixzen.setup.compatibility(),
        window.logixzen.setup.installations(),
        window.logixzen.setup.getActiveEngine
          ? window.logixzen.setup.getActiveEngine()
          : Promise.resolve({ ok: true, data: "sqlite" as EngineOptionId }),
      ]);

      if (!snapRes.ok) throw new Error(snapRes.failure.cause);
      if (!catRes.ok) throw new Error(catRes.failure.cause);
      if (!compRes.ok) throw new Error(compRes.failure.cause);
      if (!instRes.ok) throw new Error(instRes.failure.cause);

      setError(null);
      setSnapshot(snapRes.data);
      setCatalog(catRes.data);
      setCompatibility(compRes.data);
      setInstallations(instRes.data);

      const active = activeRes.ok
        ? activeRes.data
        : (instRes.data.find((i) => i.status === "ready")?.optionId ??
          instRes.data[0]?.optionId ??
          null);
      setActiveOptionId(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStorage = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined" || !window.logixzen?.setup?.storageUsage)
      return;
    setIsStorageLoading(true);
    try {
      const res = await window.logixzen.setup.storageUsage();
      if (res.ok) {
        setStorageUsage(res.data);
      }
    } finally {
      setIsStorageLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async (): Promise<void> => {
      await loadData();
      if (mounted) {
        await refreshStorage();
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [loadData, refreshStorage]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.logixzen?.setup?.subscribeProgress
    )
      return;
    const unsubscribe = window.logixzen.setup.subscribeProgress(
      (event: ProgressEvent) => {
        setActiveJob((prev) => {
          if (!prev || prev.id !== event.jobId) return prev;
          const updatedStages = prev.stages.map((stg, idx) => {
            if (idx < event.stageIndex)
              return { ...stg, status: "succeeded" as const };
            if (idx === event.stageIndex) {
              return {
                ...stg,
                status:
                  event.status === "failed"
                    ? ("failed" as const)
                    : event.status === "succeeded"
                      ? ("succeeded" as const)
                      : ("running" as const),
              };
            }
            return stg;
          });
          return {
            ...prev,
            state: event.status,
            currentStageIndex: event.stageIndex,
            stages: updatedStages,
            measurements: {
              ...prev.measurements,
              download: event.measure.determinate
                ? event.measure
                : prev.measurements.download,
            },
            waitingAction: event.waitingAction,
          };
        });
      },
    );
    return () => unsubscribe();
  }, []);

  const handleRefreshAll = async (): Promise<void> => {
    if (typeof window === "undefined" || !window.logixzen?.setup) return;
    setLoading(true);
    try {
      await window.logixzen.setup.refresh();
      await loadData();
      await refreshStorage();
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (optionId: EngineOptionId): Promise<void> => {
    if (typeof window === "undefined" || !window.logixzen?.setup) return;
    setIsActionExecuting(true);
    try {
      const res = await window.logixzen.setup.switch(optionId);
      if (res.ok) {
        setActiveJob(res.data);
        setActiveOptionId(optionId);
      } else {
        setError(res.failure.cause);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActionExecuting(false);
    }
  };

  useEffect(() => {
    if (activeJob?.state !== "succeeded") return;
    if (
      activeJob.kind === "switch" ||
      activeJob.kind === "reset-practice" ||
      activeJob.kind === "restore"
    ) {
      void useSqlStore.getState().autoConnect();
    }
  }, [activeJob?.state, activeJob?.kind]);

  const handleVerify = async (optionId: EngineOptionId): Promise<void> => {
    if (typeof window === "undefined" || !window.logixzen?.setup) return;
    setIsActionExecuting(true);
    try {
      const res = await window.logixzen.setup.verifyConnection(optionId);
      if (res.ok) {
        await loadData();
      } else {
        setError(res.failure.cause);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActionExecuting(false);
    }
  };

  const handleStartStop = async (
    optionId: EngineOptionId,
    action: "start" | "stop",
  ): Promise<void> => {
    if (typeof window === "undefined" || !window.logixzen?.setup) return;
    setIsActionExecuting(true);
    try {
      const fn =
        action === "start"
          ? window.logixzen.setup.start
          : window.logixzen.setup.stop;
      const res = await fn(optionId);
      if (res.ok) {
        setActiveJob(res.data);
      } else {
        setError(res.failure.cause);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActionExecuting(false);
    }
  };

  const handleRestartContainer = async (
    optionId: EngineOptionId,
  ): Promise<void> => {
    if (typeof window === "undefined" || !window.logixzen?.setup) return;
    setIsActionExecuting(true);
    try {
      const res = await window.logixzen.setup.restart(optionId);
      if (res.ok) {
        setActiveJob(res.data);
      } else {
        setError(res.failure.cause);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActionExecuting(false);
    }
  };

  const handleUpdateContainerImage = async (
    optionId: EngineOptionId,
  ): Promise<void> => {
    if (typeof window === "undefined" || !window.logixzen?.setup) return;
    setIsActionExecuting(true);
    try {
      const res = await window.logixzen.setup.containerUpdateImage(optionId);
      if (res.ok) {
        setActiveJob(res.data);
      } else {
        setError(res.failure.cause);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActionExecuting(false);
    }
  };

  const handleConfirmAction = async (): Promise<void> => {
    const { type, record } = confirmModal;
    if (!record || typeof window === "undefined" || !window.logixzen?.setup)
      return;
    setIsActionExecuting(true);
    try {
      if (type === "reset") {
        const res = await window.logixzen.setup.reset(record.optionId);
        if (res.ok) {
          setActiveJob(res.data);
          setConfirmModal({ open: false, type: "reset", record: null });
        } else {
          setError(res.failure.cause);
        }
      } else if (type === "uninstall") {
        const res = await window.logixzen.setup.uninstall(record.optionId);
        if (res.ok) {
          setActiveJob(res.data);
          setConfirmModal({ open: false, type: "uninstall", record: null });
        } else {
          setError(res.failure.cause);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActionExecuting(false);
    }
  };

  const handleDeleteData = async (): Promise<void> => {
    const { record } = deleteDataModal;
    if (!record || typeof window === "undefined" || !window.logixzen?.setup)
      return;
    setIsActionExecuting(true);
    try {
      const res = await window.logixzen.setup.removeData(record.optionId);
      if (res.ok) {
        setActiveJob(res.data);
        setDeleteDataModal({ open: false, record: null });
      } else {
        setError(res.failure.cause);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActionExecuting(false);
    }
  };

  const handleJobDismiss = async (): Promise<void> => {
    if (!activeJob) return;
    if (typeof window !== "undefined" && window.logixzen?.setup?.cleanupJob) {
      await window.logixzen.setup.cleanupJob(activeJob.id);
    }
    setActiveJob(null);
    await loadData();
    await refreshStorage();
  };

  const handleCancelJob = async (): Promise<void> => {
    if (!activeJob || typeof window === "undefined" || !window.logixzen?.setup)
      return;
    const res = await window.logixzen.setup.cancelJob(activeJob.id);
    if (res.ok) {
      setActiveJob(res.data);
    }
  };

  const activeEntry = useMemo(
    () => catalog.find((c) => c.id === activeOptionId) ?? null,
    [catalog, activeOptionId],
  );

  const activeRecord = useMemo(
    () => installations.find((i) => i.optionId === activeOptionId) ?? null,
    [installations, activeOptionId],
  );

  const availableOffers = useMemo(() => {
    const installedIds = new Set(installations.map((i) => i.optionId));
    return compatibility.filter(
      (o) => o.visible && !installedIds.has(o.entry.id),
    );
  }, [compatibility, installations]);

  return (
    <PageShell
      title="Databases"
      subtitle="Manage installed database engines, connections, and practice data"
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleRefreshAll()}
            disabled={loading}
            className="border-border h-7 text-[11px] gap-1.5"
          >
            <RefreshCw className={loading ? "size-3 animate-spin" : "size-3"} />
            <span>Refresh Status</span>
          </Button>

          <Button
            asChild
            size="sm"
            className="h-7 text-[11px] gap-1.5"
          >
            <Link href="/setup">
              <Plus className="size-3" />
              <span>Install Engine</span>
            </Link>
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-5xl space-y-5 px-5 py-5 text-[12px]">
        <EnvironmentSummary
          snapshot={snapshot}
          onRefresh={handleRefreshAll}
          loading={loading}
        />

        {error ? (
          <div className="border border-destructive/40 bg-destructive/10 p-3.5 text-destructive flex items-center justify-between gap-3 text-[11.5px]">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              className="border-destructive/40 h-7 text-[11px]"
            >
              Retry
            </Button>
          </div>
        ) : null}

        {activeJob ? (
          <div className="border border-border bg-surface p-4">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="size-3.5 text-primary animate-spin" />
                <span className="font-semibold text-foreground text-[12.5px]">
                  Maintenance Job in Progress — {activeJob.kind} (
                  {activeJob.optionId})
                </span>
              </div>
              {activeJob.state === "succeeded" ||
              activeJob.state === "failed" ||
              activeJob.state === "cancelled" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleJobDismiss()}
                  className="border-border h-6.5 text-[10.5px]"
                >
                  Dismiss
                </Button>
              ) : null}
            </div>
            <MaintenanceProgress
              job={activeJob}
              onCancel={handleCancelJob}
              onRetry={() => {
                if (activeJob.optionId) {
                  void handleVerify(activeJob.optionId);
                }
              }}
              onDismiss={handleJobDismiss}
              onCheckWaiting={() => {
                if (
                  typeof window !== "undefined" &&
                  window.logixzen?.setup?.checkWaitingJob
                ) {
                  void window.logixzen.setup
                    .checkWaitingJob(activeJob.id)
                    .then((res) => {
                      if (res.ok) setActiveJob(res.data);
                    });
                }
              }}
              onConfirmIrreversible={(proceed: boolean) => {
                if (
                  typeof window !== "undefined" &&
                  window.logixzen?.setup?.confirmIrreversible
                ) {
                  void window.logixzen.setup
                    .confirmIrreversible(activeJob.id, proceed)
                    .then((res) => {
                      if (res.ok) setActiveJob(res.data);
                    });
                }
              }}
            />
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : installations.length === 0 ? (
          <div className="border border-border bg-surface p-8 text-center space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center border border-border bg-surface-alt text-muted-dim">
              <Database className="size-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h2 className="text-[14px] font-semibold text-foreground">
                No Database Engines Installed
              </h2>
              <p className="text-[11.5px] text-muted">
                LogixZen requires at least one database engine to practice
                queries and run lessons. Get started with bundled SQLite in
                seconds.
              </p>
            </div>
            <div className="pt-2">
              <Button
                asChild
                size="sm"
                className="h-8 text-[12px] font-medium gap-2"
              >
                <Link href="/setup">
                  <Plus className="size-3.5" />
                  <span>Launch Engine Setup</span>
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <ActiveConnectionCard
              activeOptionId={activeOptionId}
              activeEntry={activeEntry}
              activeRecord={activeRecord}
              installedRecords={installations}
              catalog={catalog}
              onSwitch={handleSwitch}
              onVerify={handleVerify}
              isSwitching={isActionExecuting}
            />

            <InstalledEnginesTable
              records={installations}
              catalog={catalog}
              activeOptionId={activeOptionId}
              storageUsage={storageUsage}
              isStorageLoading={isStorageLoading}
              onRefreshStorage={refreshStorage}
              onSwitch={handleSwitch}
              onVerify={handleVerify}
              onStartStop={handleStartStop}
              onOpenResetConfirm={(record) =>
                setConfirmModal({ open: true, type: "reset", record })
              }
              onOpenUninstallConfirm={(record) =>
                setConfirmModal({ open: true, type: "uninstall", record })
              }
              onOpenDeleteDataConfirm={(record) =>
                setDeleteDataModal({ open: true, record })
              }
              onOpenDetails={(record) => {
                const entry =
                  catalog.find((c) => c.id === record.optionId) ?? null;
                setDetailsModal({ open: true, record, entry });
              }}
              isActionExecuting={isActionExecuting}
            />

            <AvailableEnginesSection
              availableOffers={availableOffers}
              snapshot={snapshot}
            />

            <ContainerEnvironmentsSection
              catalog={catalog}
              installedRecords={installations}
              snapshot={snapshot}
              onLifecycle={handleStartStop}
              onRestart={handleRestartContainer}
              onUpdateImage={handleUpdateContainerImage}
              onViewLogs={(optionId) => setLogsModal({ open: true, optionId })}
              isActionExecuting={isActionExecuting}
            />
          </div>
        )}
      </div>

      <ConfirmActionDialog
        type={confirmModal.type}
        engineName={
          catalog.find((c) => c.id === confirmModal.record?.optionId)
            ?.displayName ??
          confirmModal.record?.optionId ??
          ""
        }
        isOpen={confirmModal.open}
        onConfirm={handleConfirmAction}
        onCancel={() =>
          setConfirmModal({ open: false, type: "reset", record: null })
        }
        isExecuting={isActionExecuting}
      />

      <DeleteDataDialog
        engineName={
          catalog.find((c) => c.id === deleteDataModal.record?.optionId)
            ?.displayName ??
          deleteDataModal.record?.optionId ??
          ""
        }
        isOpen={deleteDataModal.open}
        onConfirm={handleDeleteData}
        onCancel={() => setDeleteDataModal({ open: false, record: null })}
        isExecuting={isActionExecuting}
      />

      <EngineDetailsDialog
        record={detailsModal.record}
        entry={detailsModal.entry}
        isOpen={detailsModal.open}
        onClose={() =>
          setDetailsModal({ open: false, record: null, entry: null })
        }
      />

      <ContainerLogsDialog
        optionId={logsModal.optionId}
        isOpen={logsModal.open}
        onClose={() => setLogsModal({ open: false, optionId: null })}
      />
    </PageShell>
  );
}
