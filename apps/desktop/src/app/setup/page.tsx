"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { ArrowRight, Database, Box, WifiOff, AlertCircle } from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { Button } from "@/components/ui/button";
import { EnvironmentSummary } from "@/components/app-shell/environment-summary";
import { EngineCard } from "@/components/setup/engine-card";
import { EngineDetails } from "@/components/setup/engine-details";
import { ConfirmationStep } from "@/components/setup/confirmation-step";
import { JobProgress } from "@/components/setup/job-progress";
import { SetupSuccess } from "@/components/setup/setup-success";
import type {
  EngineOffer,
  InstallationRecord,
  PlatformSnapshot,
} from "@/shared/engines";
import { platformOf } from "@/shared/engine-catalog";
import { cn } from "@/lib/utils";

type SetupStep = "choose" | "confirm" | "progress" | "success";

const STORAGE_KEY_SELECTION = "logixzen.setup.selectedEngines";

export default function SetupPage(): React.ReactElement {
  const [step, setStep] = useState<SetupStep>("choose");
  const [snapshot, setSnapshot] = useState<PlatformSnapshot | null>(null);
  const [offers, setOffers] = useState<EngineOffer[]>([]);
  const [installations, setInstallations] = useState<InstallationRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [loading, setLoading] = useState(
    () => typeof window !== "undefined" && window.logixzen?.setup !== undefined,
  );
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const bridge = window.logixzen?.setup;
    if (!bridge) return;

    try {
      const [snapRes, offersRes, instRes] = await Promise.all([
        bridge.snapshot(),
        bridge.compatibility(),
        bridge.installations(),
      ]);

      if (snapRes.ok) setSnapshot(snapRes.data);
      if (offersRes.ok) {
        setOffers(offersRes.data);
        if (offersRes.data.length > 0) {
          const sqlite = offersRes.data.find((o) => o.entry.id === "sqlite");
          setHighlightedId(
            (prev) => prev ?? (sqlite ? "sqlite" : offersRes.data[0].entry.id),
          );
        }
      }
      if (instRes.ok) setInstallations(instRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bridge = window.logixzen?.setup;
    if (!bridge) return;

    Promise.all([
      bridge.snapshot(),
      bridge.compatibility(),
      bridge.installations(),
    ])
      .then(([snapRes, offersRes, instRes]) => {
        if (cancelled) return;
        if (snapRes.ok) setSnapshot(snapRes.data);
        if (offersRes.ok) {
          setOffers(offersRes.data);
          if (offersRes.data.length > 0) {
            const sqlite = offersRes.data.find((o) => o.entry.id === "sqlite");
            setHighlightedId(
              (prev) =>
                prev ?? (sqlite ? "sqlite" : offersRes.data[0].entry.id),
            );
          }
        }
        if (instRes.ok) setInstallations(instRes.data);

        try {
          const saved = localStorage.getItem(STORAGE_KEY_SELECTION);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSelectedIds(parsed);
            } else {
              setSelectedIds(["sqlite"]);
            }
          } else {
            setSelectedIds(["sqlite"]);
          }
        } catch {
          setSelectedIds(["sqlite"]);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleSelect = (optionId: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId];
      try {
        localStorage.setItem(STORAGE_KEY_SELECTION, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const localOffers = useMemo(
    () => offers.filter((o) => o.visible && o.entry.method !== "container"),
    [offers],
  );

  const containerOffers = useMemo(
    () => offers.filter((o) => o.visible && o.entry.method === "container"),
    [offers],
  );

  const highlightedOffer = useMemo(
    () =>
      offers.find((o) => o.entry.id === highlightedId) ?? (offers[0] || null),
    [offers, highlightedId],
  );

  const highlightedInstallation = useMemo(
    () => installations.find((i) => i.optionId === highlightedOffer?.entry.id),
    [installations, highlightedOffer],
  );

  const selectedOffers = useMemo(
    () => offers.filter((o) => selectedIds.includes(o.entry.id)),
    [offers, selectedIds],
  );

  const needsDownload = useMemo(() => {
    const platform = snapshot ? platformOf(snapshot) : "windows-x64";
    return selectedOffers.some((o) => {
      const size =
        (platform && o.entry.sizes[platform]) ??
        Object.values(o.entry.sizes)[0];
      return (size?.downloadBytes ?? 0) > 0;
    });
  }, [selectedOffers, snapshot]);

  const handleStepChange = (newStep: SetupStep) => {
    setStep(newStep);
    setAnnouncement(`Step changed to ${newStep}`);
  };

  return (
    <PageShell
      title="Database Engine Setup"
      subtitle="Configure local database engines and practice environments for your machine"
    >
      <div className="mx-auto max-w-5xl px-5 py-5 space-y-4">
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>

        <div className="flex items-center justify-between border-b border-border pb-2 text-[11px]">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "px-2 py-0.5 font-medium uppercase tracking-wider text-[10px]",
                step === "choose"
                  ? "border border-primary bg-primary/10 text-primary"
                  : "text-muted-dim",
              )}
            >
              1. Choose Engines
            </span>
            <span className="text-muted-dim">/</span>
            <span
              className={cn(
                "px-2 py-0.5 font-medium uppercase tracking-wider text-[10px]",
                step === "confirm"
                  ? "border border-primary bg-primary/10 text-primary"
                  : "text-muted-dim",
              )}
            >
              2. Review & Confirm
            </span>
            <span className="text-muted-dim">/</span>
            <span
              className={cn(
                "px-2 py-0.5 font-medium uppercase tracking-wider text-[10px]",
                step === "progress"
                  ? "border border-primary bg-primary/10 text-primary"
                  : "text-muted-dim",
              )}
            >
              3. Install & Verify
            </span>
            <span className="text-muted-dim">/</span>
            <span
              className={cn(
                "px-2 py-0.5 font-medium uppercase tracking-wider text-[10px]",
                step === "success"
                  ? "border border-success bg-success/10 text-success"
                  : "text-muted-dim",
              )}
            >
              4. Ready
            </span>
          </div>

          <div className="flex items-center gap-2 text-muted-dim text-[10.5px]">
            {!isOnline ? (
              <span className="flex items-center gap-1 text-warning">
                <WifiOff className="size-3" />
                Offline
              </span>
            ) : null}
          </div>
        </div>

        {step === "choose" || step === "confirm" ? (
          <EnvironmentSummary
            snapshot={snapshot}
            onRefresh={loadData}
            loading={loading}
          />
        ) : null}

        {!isOnline &&
        needsDownload &&
        (step === "choose" || step === "confirm") ? (
          <div className="border border-warning/40 bg-warning/10 p-3 text-[11px] text-warning flex items-start gap-2">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">Offline Mode Detected</span>
              <p className="mt-0.5 text-foreground leading-relaxed">
                One or more selected engines require downloading packages from
                official sources. Please connect to the internet, or choose
                SQLite which is bundled and requires no download.
              </p>
            </div>
          </div>
        ) : null}

        {step === "choose" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                {localOffers.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-muted-dim text-[10px] font-medium uppercase tracking-wider">
                      <Database className="size-3 text-primary" />
                      <span>Local Database Engines</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {localOffers.map((offer) => (
                        <EngineCard
                          key={offer.entry.id}
                          offer={offer}
                          snapshot={snapshot}
                          installation={installations.find(
                            (i) => i.optionId === offer.entry.id,
                          )}
                          selected={selectedIds.includes(offer.entry.id)}
                          active={highlightedId === offer.entry.id}
                          onToggleSelect={handleToggleSelect}
                          onHighlight={(id) => setHighlightedId(id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {containerOffers.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-muted-dim text-[10px] font-medium uppercase tracking-wider">
                      <Box className="size-3 text-primary" />
                      <span>Container Engines (Docker)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {containerOffers.map((offer) => (
                        <EngineCard
                          key={offer.entry.id}
                          offer={offer}
                          snapshot={snapshot}
                          installation={installations.find(
                            (i) => i.optionId === offer.entry.id,
                          )}
                          selected={selectedIds.includes(offer.entry.id)}
                          active={highlightedId === offer.entry.id}
                          onToggleSelect={handleToggleSelect}
                          onHighlight={(id) => setHighlightedId(id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-4">
                  <EngineDetails
                    offer={highlightedOffer}
                    snapshot={snapshot}
                    installation={highlightedInstallation}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-[11px] text-muted-dim">
                {selectedIds.length}{" "}
                {selectedIds.length === 1 ? "engine" : "engines"} selected
              </span>

              <Button
                type="button"
                size="sm"
                onClick={() => handleStepChange("confirm")}
                disabled={selectedIds.length === 0}
                className="h-8 text-[11.5px] px-4 font-medium gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}

        {step === "confirm" ? (
          <ConfirmationStep
            selectedOffers={selectedOffers}
            snapshot={snapshot}
            onConfirm={() => handleStepChange("progress")}
            onBack={() => handleStepChange("choose")}
          />
        ) : null}

        {step === "progress" ? (
          <JobProgress
            optionIds={selectedIds}
            onComplete={() => handleStepChange("success")}
            onCancelAll={() => handleStepChange("choose")}
          />
        ) : null}

        {step === "success" ? (
          <SetupSuccess
            installedOptions={selectedIds}
            onResetSetup={() => {
              setSelectedIds(["sqlite"]);
              handleStepChange("choose");
            }}
          />
        ) : null}
      </div>
    </PageShell>
  );
}
