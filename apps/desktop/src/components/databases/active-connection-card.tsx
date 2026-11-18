"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRightLeft,
  Database,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import type {
  EngineCatalogEntry,
  EngineOptionId,
  InstallationRecord,
} from "@/shared/engines";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActiveConnectionCardProps {
  activeOptionId: EngineOptionId | null;
  activeEntry: EngineCatalogEntry | null;
  activeRecord: InstallationRecord | null;
  installedRecords: InstallationRecord[];
  catalog: EngineCatalogEntry[];
  onSwitch: (optionId: EngineOptionId) => Promise<void>;
  onVerify: (optionId: EngineOptionId) => Promise<void>;
  isSwitching?: boolean;
}

export function ActiveConnectionCard({
  activeOptionId,
  activeEntry,
  activeRecord,
  installedRecords,
  catalog,
  onSwitch,
  onVerify,
  isSwitching = false,
}: ActiveConnectionCardProps): React.ReactElement {
  const [selectedSwitchOption, setSelectedSwitchOption] = useState<
    EngineOptionId | ""
  >(
    () =>
      installedRecords.find(
        (r) => r.optionId !== activeOptionId && r.status === "ready",
      )?.optionId ?? "",
  );
  const [testing, setTesting] = useState(false);

  const status = activeRecord?.status ?? "not-installed";
  const isReady = status === "ready";
  const isNeedsRepair = status === "needs-repair";

  const handleTest = async (): Promise<void> => {
    if (!activeOptionId) return;
    setTesting(true);
    try {
      await onVerify(activeOptionId);
    } finally {
      setTesting(false);
    }
  };

  const handleSwitchSubmit = async (): Promise<void> => {
    if (!selectedSwitchOption) return;
    await onSwitch(selectedSwitchOption);
  };

  const readyAlternates = installedRecords.filter(
    (rec) => rec.optionId !== activeOptionId && rec.status === "ready",
  );

  return (
    <div className="border border-border bg-surface p-4 text-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-primary shrink-0" />
          <h2 className="text-[13px] font-semibold text-foreground">
            Active Connection
          </h2>
          <span
            className={cn(
              "border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider font-mono",
              isReady
                ? "border-success/30 bg-success/10 text-success"
                : isNeedsRepair
                  ? "border-warning/30 bg-warning/10 text-warning"
                  : "border-border bg-surface-alt text-muted",
            )}
          >
            {status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            className="rounded-none h-7.5 px-3 text-[11.5px] font-medium gap-1.5"
          >
            <Link href="/playground">
              <Terminal className="size-3.5" />
              <span>Open in SQL Editor</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing || !activeOptionId}
            className="rounded-none border-border h-7.5 px-2.5 text-[11px] gap-1.5"
          >
            <RefreshCw className={cn("size-3", testing && "animate-spin")} />
            <span>Test Connection</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-b border-border text-[11.5px]">
        <div>
          <span className="text-[10px] uppercase font-mono text-muted-dim block">
            Engine
          </span>
          <span className="font-medium text-foreground">
            {activeEntry?.displayName ?? activeOptionId ?? "None"}
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono text-muted-dim block">
            Database
          </span>
          <span className="font-mono text-foreground">LogixZenPractice</span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono text-muted-dim block">
            Target
          </span>
          <span className="font-mono text-foreground truncate block">
            {activeRecord?.dataLocation ??
              (activeRecord?.port
                ? `127.0.0.1:${activeRecord.port}`
                : "practice.db")}
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-mono text-muted-dim block">
            Dialect
          </span>
          <span className="font-mono uppercase text-foreground">
            {activeEntry?.dialect ?? "sqlite"}
          </span>
        </div>
      </div>

      {activeRecord?.lastVerification ? (
        <div className="flex items-center gap-2 pt-2 text-[11px] text-muted font-mono">
          <ShieldCheck className="size-3.5 text-success shrink-0" />
          <span>
            Verified{" "}
            {new Date(
              activeRecord.lastVerification.checkedAt,
            ).toLocaleTimeString()}
            : {activeRecord.lastVerification.detail ?? "Connected successfully"}
          </span>
        </div>
      ) : null}

      {readyAlternates.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 bg-surface-alt/40 p-2.5">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="size-3.5 text-muted-dim shrink-0" />
            <span className="text-[11.5px] text-muted">Switch engine:</span>
            <select
              value={selectedSwitchOption}
              onChange={(e) =>
                setSelectedSwitchOption(e.target.value as EngineOptionId)
              }
              className="bg-surface border border-border px-2 py-1 text-[11.5px] font-mono text-foreground focus:outline-none focus:border-ring"
            >
              {readyAlternates.map((alt) => {
                const altEntry = catalog.find((c) => c.id === alt.optionId);
                return (
                  <option key={alt.optionId} value={alt.optionId}>
                    {altEntry?.displayName ?? alt.optionId}
                  </option>
                );
              })}
            </select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSwitchSubmit}
            disabled={!selectedSwitchOption || isSwitching}
            className="rounded-none border-border h-7 text-[11px] gap-1.5"
          >
            <span>Switch Active Engine</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
