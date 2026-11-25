"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
  HardDrive,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { EnvironmentSummary } from "@/components/app-shell/environment-summary";
import { Button } from "@/components/ui/button";
import { StatusChip, StatusDot } from "@/components/ui/status-chip";
import { platformOf } from "@/shared/engine-catalog";
import { formatBytes } from "@/shared/format";
import type {
  EngineCatalogEntry,
  EngineOffer,
  EngineOptionId,
  InstallationRecord,
  Job,
  PlatformSnapshot,
  RequirementKind,
  VerificationResult,
} from "@/shared/engines";
import { errorMessage, isJobFinished, waitForJob } from "@/lib/engine-jobs";
import { useSqlStore } from "@/sql/useSqlStore";
import { cn } from "@/lib/utils";

type Step = "select" | "review" | "install" | "done";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "select", label: "Select" },
  { id: "review", label: "Review" },
  { id: "install", label: "Install" },
  { id: "done", label: "Ready" },
];

const LICENSE_IDS = new Set<string>([
  "mysql",
  "sqlserver",
  "mssql-container",
]);

const REQUIREMENT_LABELS: Record<RequirementKind, string> = {
  platform: "Operating system",
  "os-version": "Windows version",
  distro: "Linux distribution",
  memory: "Memory",
  disk: "Free disk space",
  "container-runtime": "Container runtime",
};

function downloadBytesFor(
  entry: EngineCatalogEntry,
  snapshot: PlatformSnapshot | null,
): number {
  const platform = snapshot === null ? null : platformOf(snapshot);
  if (platform !== null && entry.sizes[platform] !== undefined) {
    return entry.sizes[platform]?.downloadBytes ?? 0;
  }
  return Object.values(entry.sizes)[0]?.downloadBytes ?? 0;
}

function installedBytesFor(
  entry: EngineCatalogEntry,
  snapshot: PlatformSnapshot | null,
): number {
  const platform = snapshot === null ? null : platformOf(snapshot);
  const size =
    (platform !== null ? entry.sizes[platform] : undefined) ??
    Object.values(entry.sizes)[0];
  return size?.installedBytes ?? entry.minDiskBytes ?? 0;
}

function methodLabel(entry: EngineCatalogEntry): string {
  if (entry.method === "bundled") return "Bundled";
  if (entry.method === "container") return "Container";
  return "Local server";
}

function statusLabel(record: InstallationRecord | undefined): {
  label: string;
  tone: "success" | "warning" | "info" | "neutral";
} {
  if (record === undefined) return { label: "Not installed", tone: "neutral" };
  if (record.status === "ready") return { label: "Installed", tone: "success" };
  if (record.status === "needs-repair") {
    return { label: "Needs repair", tone: "warning" };
  }
  if (record.status === "stopped") return { label: "Stopped", tone: "info" };
  return { label: record.status, tone: "neutral" };
}

export default function SetupPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-muted-dim">
          <Loader2 className="size-4 animate-spin text-primary" />
        </div>
      }
    >
      <SetupContent />
    </Suspense>
  );
}

function SetupContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const preselect = searchParams.get("preselect");
  const [step, setStep] = useState<Step>("select");
  const [snapshot, setSnapshot] = useState<PlatformSnapshot | null>(null);
  const [offers, setOffers] = useState<EngineOffer[]>([]);
  const [installations, setInstallations] = useState<InstallationRecord[]>([]);
  const [selectedId, setSelectedId] = useState<EngineOptionId | null>(
    (preselect as EngineOptionId) || null,
  );
  const [licenseAccepted, setLicenseAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [activity, setActivity] = useState("");
  const [percent, setPercent] = useState<number | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(
    null,
  );
  const [installedName, setInstalledName] = useState("");

  const load = useCallback(async (): Promise<void> => {
    const bridge = window.logixzen?.setup;
    if (bridge === undefined) {
      setLoading(false);
      return;
    }
    try {
      const [snapshotResult, offerResult, installationResult] =
        await Promise.all([
          bridge.snapshot(),
          bridge.compatibility(),
          bridge.installations(),
        ]);
      if (snapshotResult.ok) setSnapshot(snapshotResult.data);
      if (offerResult.ok) setOffers(offerResult.data);
      if (installationResult.ok) setInstallations(installationResult.data);
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const bridge = window.logixzen?.setup;
    if (bridge === undefined) return;
    return bridge.subscribeProgress((event) => {
      setActivity(event.activity);
      if (event.measure.determinate) {
        setPercent(event.measure.percent);
      } else {
        setPercent(null);
      }
    });
  }, []);

  useEffect(() => {
    if (jobId === null) return;
    let cancelled = false;
    const poll = window.setInterval(() => {
      void window.logixzen?.setup.getJob(jobId).then((result) => {
        if (cancelled || !result.ok || result.data === null) return;
        setJob(result.data);
        if (isJobFinished(result.data)) {
          window.clearInterval(poll);
        }
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [jobId]);

  const installedIds = useMemo(
    () => new Set(installations.map((item) => item.optionId)),
    [installations],
  );

  const available = useMemo(
    () =>
      offers
        .filter((offer) => offer.visible && !installedIds.has(offer.entry.id))
        .sort((left, right) => {
          if (left.entry.method !== right.entry.method) {
            return left.entry.method === "bundled" ? -1 : 1;
          }
          return left.entry.displayName.localeCompare(right.entry.displayName);
        }),
    [offers, installedIds],
  );

  const installed = useMemo(
    () =>
      offers.filter(
        (offer) => offer.visible && installedIds.has(offer.entry.id),
      ),
    [offers, installedIds],
  );

  const selected = useMemo(
    () => offers.find((offer) => offer.entry.id === selectedId) ?? null,
    [offers, selectedId],
  );

  const requiresLicense =
    selected !== null && LICENSE_IDS.has(selected.entry.id);

  const unmetChecks = useMemo(
    () =>
      selected === null
        ? []
        : selected.checks.filter(
            (check) => check.status === "unmet" || check.status === "unknown",
          ),
    [selected],
  );

  const canContinue =
    selected !== null &&
    selected.visible &&
    unmetChecks.length === 0;

  const canInstall =
    canContinue && (!requiresLicense || licenseAccepted);

  const runUse = async (optionId: EngineOptionId): Promise<void> => {
    const bridge = window.logixzen?.setup;
    if (bridge === undefined) return;
    setError(null);
    try {
      const started = await bridge.switch(optionId);
      if (!started.ok) {
        setError(started.failure.cause);
        return;
      }
      const finished = await waitForJob(started.data.id);
      if (finished !== null && finished.state === "failed") {
        setError(finished.failure?.cause ?? "The engine could not start.");
      }
      await load();
    } catch (useError) {
      setError(errorMessage(useError));
    }
  };

  const runInstall = async (): Promise<void> => {
    if (selected === null) return;
    const bridge = window.logixzen?.setup;
    if (bridge === undefined) return;

    setStep("install");
    setError(null);
    setJob(null);
    setPercent(null);
    setActivity("Preparing installation");
    setInstalledName(selected.entry.displayName);

    try {
      const started = await bridge.startJob({
        optionId: selected.entry.id,
        kind: "install",
      });
      if (!started.ok) {
        setError(started.failure.cause);
        return;
      }
      setJob(started.data);
      setJobId(started.data.id);
      const finished = await waitForJob(started.data.id);
      if (finished !== null) setJob(finished);

      if (finished === null) {
        setError("Installation did not report a result. Check the job state.");
        return;
      }
      if (finished.state === "cancelled") {
        setError("Installation cancelled.");
        return;
      }
      if (finished.state !== "succeeded") {
        setError(
          finished.failure?.cause ??
            finished.failure?.detail ??
            "Installation failed.",
        );
        return;
      }

      const check = await bridge.verifyConnection(selected.entry.id);
      if (check.ok) {
        setVerification(check.data);
        if (!check.data.ok) {
          setError(check.data.detail ?? "Connection verification failed.");
          return;
        }
      }

      await load();
      void useSqlStore.getState().autoConnect();
      setStep("done");
    } catch (installError) {
      setError(errorMessage(installError));
    } finally {
      setJobId(null);
    }
  };

  const resetToSelect = (): void => {
    setStep("select");
    setSelectedId(null);
    setLicenseAccepted(false);
    setJob(null);
    setPercent(null);
    setActivity("");
    setError(null);
    setVerification(null);
    void load();
  };

  return (
    <PageShell
      title="Engine setup"
      subtitle="Install one SQL engine and a practice database"
    >
      <div className="mx-auto w-full max-w-4xl px-4 py-4 text-[12px]">
        <StepBar step={step} />

        <div className="mt-3">
          <EnvironmentSummary
            snapshot={snapshot}
            onRefresh={load}
            loading={loading}
          />
        </div>

        {error !== null ? (
          <div className="mt-3 flex items-start gap-2 border border-destructive/40 bg-destructive/10 p-2.5 text-[11.5px] text-destructive">
            <AlertCircle className="mt-px size-3.5 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        ) : null}

        {step === "select" ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              {installed.length > 0 ? (
                <section className="border border-border bg-surface">
                  <header className="flex h-8 items-center border-b border-border px-3">
                    <span className="section-label">Installed</span>
                  </header>
                  <div className="divide-y divide-border">
                    {installed.map((offer) => {
                      const record = installations.find(
                        (item) => item.optionId === offer.entry.id,
                      );
                      const status = statusLabel(record);
                      return (
                        <div
                          key={offer.entry.id}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Database className="size-3.5 shrink-0 text-primary" />
                            <span className="truncate font-medium">
                              {offer.entry.displayName}
                            </span>
                            <StatusChip tone={status.tone}>
                              {status.label}
                            </StatusChip>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px] text-muted-dim hover:text-foreground"
                            >
                              <Link href="/databases">Manage</Link>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 border-border px-2 text-[11px]"
                              onClick={() => void runUse(offer.entry.id)}
                            >
                              Use
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <section className="border border-border bg-surface">
                <header className="flex h-8 items-center justify-between border-b border-border px-3">
                  <span className="section-label">Available engines</span>
                  <span className="text-[10px] text-muted-dim">
                    {available.length}
                  </span>
                </header>
                {loading ? (
                  <div className="flex items-center gap-2 px-3 py-6 text-[11.5px] text-muted-dim">
                    <Loader2 className="size-3.5 animate-spin" />
                    Detecting compatible engines
                  </div>
                ) : available.length === 0 ? (
                  <div className="px-3 py-6 text-[11.5px] text-muted-dim">
                    Every compatible engine is already installed.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {available.map((offer) => {
                      const entry = offer.entry;
                      const isSelected = selectedId === entry.id;
                      const download = downloadBytesFor(entry, snapshot);
                      const blocked = offer.checks.some(
                        (check) =>
                          check.status === "unmet" ||
                          check.status === "unknown",
                      );
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          disabled={blocked}
                          aria-pressed={isSelected}
                          onClick={() => {
                            setSelectedId(entry.id);
                            setLicenseAccepted(false);
                          }}
                          className={cn(
                            "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors",
                            blocked
                              ? "cursor-not-allowed opacity-55"
                              : "hover:bg-surface-hover/60",
                            isSelected && "bg-surface-hover",
                          )}
                        >
                          <div className="flex min-w-0 gap-2.5">
                            <span
                              className={cn(
                                "mt-0.5 flex size-3.5 shrink-0 items-center justify-center border",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-input",
                              )}
                            >
                              {isSelected ? <Check className="size-2.5" /> : null}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-medium text-foreground">
                                  {entry.displayName}
                                </span>
                                <span className="font-mono text-[10px] text-muted-dim">
                                  {entry.pin}
                                </span>
                                {entry.recommended ? (
                                  <StatusChip tone="info">Recommended</StatusChip>
                                ) : null}
                              </div>
                              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">
                                {entry.purpose}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-muted-dim">
                                <span>{methodLabel(entry)}</span>
                                <span>{entry.license}</span>
                                <span>
                                  {download > 0
                                    ? `${formatBytes(download)} download`
                                    : "No download"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <StatusChip tone={blocked ? "warning" : "neutral"}>
                            {blocked ? "Unsupported" : "Ready to install"}
                          </StatusChip>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <EngineDetails
              offer={selected}
              record={
                selected === null
                  ? undefined
                  : installations.find(
                      (item) => item.optionId === selected.entry.id,
                    )
              }
              snapshot={snapshot}
            />
          </div>
        ) : null}

        {step === "review" && selected !== null ? (
          <div className="mt-3 border border-border bg-surface">
            <header className="flex h-8 items-center border-b border-border px-3">
              <span className="section-label">Review installation</span>
            </header>
            <dl className="divide-y divide-border text-[11.5px]">
              <ReviewRow
                label="Engine"
                value={`${selected.entry.displayName} ${selected.entry.pin}`}
              />
              <ReviewRow label="Publisher" value={selected.entry.publisher} />
              <ReviewRow
                label="Source"
                value={selected.entry.sourceUrl}
                mono
              />
              <ReviewRow
                label="Download"
                value={
                  downloadBytesFor(selected.entry, snapshot) > 0
                    ? formatBytes(downloadBytesFor(selected.entry, snapshot))
                    : "Bundled with the app"
                }
              />
              <ReviewRow
                label="Disk after install"
                value={formatBytes(installedBytesFor(selected.entry, snapshot))}
              />
              <ReviewRow
                label="Practice database"
                value="Local app data, created and seeded automatically"
                mono
              />
              {selected.entry.elevation === "required" ? (
                <div className="flex items-start gap-2 px-3 py-2 text-warning">
                  <ShieldAlert className="mt-px size-3.5 shrink-0" />
                  <span>
                    Windows will ask for administrator approval once to install
                    the Microsoft packages.
                  </span>
                </div>
              ) : null}
              {requiresLicense ? (
                <div className="px-3 py-2.5">
                  <div className="text-muted-dim">License</div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-foreground">
                    {selected.entry.license}
                  </p>
                  <label className="mt-2 flex items-start gap-2 text-[11.5px]">
                    <input
                      type="checkbox"
                      checked={licenseAccepted}
                      onChange={(event) =>
                        setLicenseAccepted(event.target.checked)
                      }
                      className="mt-0.5 size-3.5 accent-[var(--primary)]"
                    />
                    <span>I accept the license terms of this engine.</span>
                  </label>
                </div>
              ) : null}
            </dl>

            <div className="flex items-center justify-between border-t border-border px-3 py-2.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-[11px] text-muted-dim hover:text-foreground"
                onClick={() => setStep("select")}
              >
                <ArrowLeft className="size-3" />
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1.5 px-3 text-[11.5px]"
                disabled={!canInstall}
                onClick={() => void runInstall()}
              >
                Install {selected.entry.displayName}
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </div>
        ) : null}

        {step === "install" ? (
          <div className="mt-3 border border-border bg-surface">
            <header className="flex h-8 items-center justify-between border-b border-border px-3">
              <span className="section-label">Installing {installedName}</span>
              {job !== null ? (
                <span className="font-mono text-[10px] text-muted-dim">
                  {job.state}
                </span>
              ) : null}
            </header>
            <div className="space-y-3 px-3 py-3">
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">{activity || "Working"}</span>
                  {percent !== null ? (
                    <span className="font-mono text-foreground">{percent}%</span>
                  ) : null}
                </div>
                <div className="mt-1.5 h-1 border border-border bg-surface-alt">
                  <div
                    className="h-full bg-primary transition-all duration-150"
                    style={{
                      width: `${
                        percent !== null
                          ? Math.min(100, Math.max(0, percent))
                          : job && job.stages.length > 0
                            ? Math.round(
                                (job.currentStageIndex / job.stages.length) * 100,
                              )
                            : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {job !== null ? (
                <ol className="divide-y divide-border border border-border">
                  {job.stages.map((stage, index) => {
                    const active =
                      job.state !== "succeeded" &&
                      index === job.currentStageIndex;
                    const failed =
                      job.state === "failed" && index === job.currentStageIndex;
                    const passed =
                      job.state === "succeeded" || index < job.currentStageIndex;
                    return (
                      <li
                        key={stage.id}
                        className="flex items-center justify-between px-2.5 py-1.5 text-[11px]"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5",
                              failed
                                ? "bg-destructive"
                                : passed
                                  ? "bg-success"
                                  : active
                                    ? "bg-primary animate-pulse"
                                    : "bg-border",
                            )}
                          />
                          <span
                            className={cn(
                              passed ? "text-foreground" : "text-muted-dim",
                            )}
                          >
                            {stage.label}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] text-muted-dim">
                          {failed
                            ? "failed"
                            : passed
                              ? "done"
                              : active
                                ? "running"
                                : "pending"}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : null}

              {jobId !== null ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 border-border px-2 text-[11px] text-muted-dim hover:text-destructive"
                    onClick={() => {
                      if (jobId !== null) {
                        void window.logixzen?.setup.cancelJob(jobId);
                      }
                    }}
                  >
                    Cancel installation
                  </Button>
                </div>
              ) : (
                <div className="flex justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-muted-dim hover:text-foreground"
                    onClick={resetToSelect}
                  >
                    Back to engines
                  </Button>
                  {selected !== null ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-3 text-[11.5px]"
                      onClick={() => void runInstall()}
                    >
                      Retry installation
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {step === "done" ? (
          <div className="mt-3 border border-border bg-surface">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <CheckCircle2 className="size-4 text-success" />
              <span className="font-semibold">{installedName} is ready</span>
            </div>
            <div className="space-y-3 px-3 py-3">
              <p className="text-[11.5px] leading-relaxed text-muted">
                The engine is running on loopback and the practice database has
                been created. You can start writing SQL now.
              </p>
              {verification !== null ? (
                <div className="flex items-center gap-2 border border-border bg-surface-alt/50 px-2.5 py-1.5 font-mono text-[10.5px] text-muted">
                  <StatusDot tone={verification.ok ? "success" : "warning"} />
                  {verification.detail ?? "Connection verified"}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button asChild size="sm" className="h-7 px-3 text-[11.5px]">
                  <Link href="/playground">Open editor</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-7 border-border px-2.5 text-[11px]"
                >
                  <Link href="/databases">Manage engines</Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-muted-dim hover:text-foreground"
                  onClick={resetToSelect}
                >
                  Install another engine
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {step === "select" ? (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
            <span className="text-[11px] text-muted-dim">
              {selected === null
                ? "Select an engine to continue."
                : `${selected.entry.displayName} selected`}
            </span>
            <Button
              type="button"
              size="sm"
              className="h-7 gap-1.5 px-3 text-[11.5px]"
              disabled={!canContinue}
              onClick={() => setStep("review")}
            >
              Continue
              <ArrowRight className="size-3" />
            </Button>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}

function StepBar({ step }: { step: Step }): React.ReactElement {
  const current = STEPS.findIndex((entry) => entry.id === step);
  return (
    <ol className="flex items-center gap-1.5">
      {STEPS.map((entry, index) => (
        <li key={entry.id} className="flex items-center gap-1.5">
          <span
            className={cn(
              "flex items-center gap-1.5 border px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
              index === current
                ? "border-primary/40 bg-primary/10 text-primary"
                : index < current
                  ? "border-success/35 bg-success/10 text-success"
                  : "border-border text-muted-dim",
            )}
          >
            <span className="font-mono">{index + 1}</span>
            {entry.label}
          </span>
          {index < STEPS.length - 1 ? (
            <span className="text-[10px] text-muted-dim">/</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <dt className="text-muted-dim">{label}</dt>
      <dd
        className={cn(
          "max-w-[70%] break-words text-right text-foreground",
          mono && "font-mono text-[10.5px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function EngineDetails({
  offer,
  record,
  snapshot,
}: {
  offer: EngineOffer | null;
  record: InstallationRecord | undefined;
  snapshot: PlatformSnapshot | null;
}): React.ReactElement {
  if (offer === null) {
    return (
      <aside className="border border-border bg-surface p-3 text-[11.5px] text-muted-dim">
        Select an engine to see its requirements, license and install source.
      </aside>
    );
  }

  const { entry } = offer;
  const download = downloadBytesFor(entry, snapshot);
  const status = statusLabel(record);

  return (
    <aside className="space-y-3 border border-border bg-surface p-3 text-[11.5px]">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-foreground">
            {entry.displayName}
          </h2>
          <StatusChip tone={status.tone}>{status.label}</StatusChip>
        </div>
        <p className="mt-1 leading-relaxed text-muted">{entry.purpose}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-y border-border py-2.5 font-mono text-[10.5px]">
        <div>
          <dt className="text-muted-dim">Version</dt>
          <dd className="text-foreground">{entry.pin}</dd>
        </div>
        <div>
          <dt className="text-muted-dim">Method</dt>
          <dd className="text-foreground">{methodLabel(entry)}</dd>
        </div>
        <div>
          <dt className="text-muted-dim">Download</dt>
          <dd className="text-foreground">
            {download > 0 ? formatBytes(download) : "Bundled"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-dim">Min disk</dt>
          <dd className="text-foreground">
            {formatBytes(entry.minDiskBytes ?? 0)}
          </dd>
        </div>
      </dl>

      <div>
        <span className="section-label">Requirements</span>
        <ul className="mt-1.5 space-y-1">
          {offer.checks.length === 0 ? (
            <li className="flex items-center gap-1.5 text-success">
              <Check className="size-3" />
              No extra requirements
            </li>
          ) : (
            offer.checks.map((check) => (
              <li
                key={check.kind}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-muted">
                  {REQUIREMENT_LABELS[check.kind]}
                </span>
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    check.status === "met"
                      ? "text-success"
                      : check.status === "warn"
                        ? "text-warning"
                        : "text-destructive",
                  )}
                >
                  {check.status}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>

      <div>
        <span className="section-label">License</span>
        <p className="mt-1 leading-relaxed text-muted">{entry.license}</p>
      </div>

      <div>
        <span className="section-label">Source</span>
        <p className="mt-1 break-words font-mono text-[10px] text-muted">
          {entry.sourceUrl}
        </p>
      </div>

      <div className="flex items-center gap-1.5 border-t border-border pt-2 text-[10.5px] text-muted-dim">
        <HardDrive className="size-3" />
        Practice data is stored in the app data directory.
      </div>
    </aside>
  );
}
