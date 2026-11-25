"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightLeft, RefreshCw, ShieldCheck, Terminal } from "lucide-react";
import type {
  EngineCatalogEntry,
  EngineOptionId,
  InstallationRecord,
} from "@/shared/engines";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app-shell/panel";
import { StatusChip, type StatusTone } from "@/components/ui/status-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { statusLabel } from "@/lib/engine-status";
import { cn } from "@/lib/utils";

interface ActiveConnectionCardProps {
  activeOptionId: EngineOptionId | null;
  activeDatabase: string | null;
  activeEntry: EngineCatalogEntry | null;
  activeRecord: InstallationRecord | null;
  installedRecords: InstallationRecord[];
  catalog: EngineCatalogEntry[];
  onSwitch: (optionId: EngineOptionId) => Promise<void>;
  onVerify: (optionId: EngineOptionId) => Promise<void>;
  isSwitching?: boolean;
}

function statusTone(status: InstallationRecord["status"]): StatusTone {
  if (status === "ready") return "success";
  if (status === "needs-repair" || status === "failed") return "warning";
  return "neutral";
}

export function ActiveConnectionCard({
  activeOptionId,
  activeDatabase,
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
  >("");
  const [testing, setTesting] = useState(false);

  const status = activeRecord?.status ?? "not-installed";
  const readyAlternates = installedRecords.filter(
    (record) => record.optionId !== activeOptionId && record.status === "ready",
  );
  const switchOption: EngineOptionId | "" =
    readyAlternates.find((record) => record.optionId === selectedSwitchOption)
      ?.optionId ??
    readyAlternates[0]?.optionId ??
    "";

  const handleTest = async (): Promise<void> => {
    if (!activeOptionId) return;
    setTesting(true);
    try {
      await onVerify(activeOptionId);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Panel
      title="Active connection"
      description="Queries in the editor run on this engine and database."
      actions={
        <>
          <StatusChip tone={statusTone(status)}>{statusLabel(status)}</StatusChip>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleTest()}
            disabled={testing || !activeOptionId}
            className="h-7 gap-1.5 border-border px-2 text-[11px]"
          >
            <RefreshCw className={cn("size-3", testing && "animate-spin")} />
            Test
          </Button>
          <Button asChild size="sm" className="h-7 gap-1.5 px-2.5 text-[11px]">
            <Link href="/playground">
              <Terminal className="size-3" />
              Open editor
            </Link>
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-2 divide-border border-b border-border sm:grid-cols-4 sm:divide-x">
        <Meta label="Engine">
          {activeEntry?.displayName ?? activeOptionId ?? "None"}
        </Meta>
        <Meta label="Database" mono>
          {activeDatabase ?? "practice"}
        </Meta>
        <Meta label="Target" mono>
          {activeRecord?.dataLocation ??
            (activeRecord?.port ? `127.0.0.1:${activeRecord.port}` : "—")}
        </Meta>
        <Meta label="Dialect" mono>
          {activeEntry?.dialect ?? "—"}
        </Meta>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
        {activeRecord?.lastVerification ? (
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
            <ShieldCheck className="size-3.5 shrink-0 text-success" />
            <span className="truncate">
              Verified{" "}
              {new Date(
                activeRecord.lastVerification.checkedAt,
              ).toLocaleTimeString()}
              {" · "}
              {activeRecord.lastVerification.detail ?? "Connected"}
            </span>
          </span>
        ) : (
          <span className="text-[11px] text-muted-dim">
            Connection has not been verified yet.
          </span>
        )}

        {readyAlternates.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <ArrowRightLeft className="size-3.5 shrink-0 text-muted-dim" />
            <Select
              value={switchOption}
              onValueChange={(value) =>
                setSelectedSwitchOption(value as EngineOptionId)
              }
            >
              <SelectTrigger
                size="sm"
                className="h-7 w-44 border-border text-[11px]"
                aria-label="Engine to switch to"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {readyAlternates.map((alternate) => (
                  <SelectItem
                    key={alternate.optionId}
                    value={alternate.optionId}
                    className="text-[11.5px]"
                  >
                    {catalog.find((entry) => entry.id === alternate.optionId)
                      ?.displayName ?? alternate.optionId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (switchOption) void onSwitch(switchOption);
              }}
              disabled={!switchOption || isSwitching}
              className="h-7 border-border px-2 text-[11px]"
            >
              Switch
            </Button>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function Meta({
  label,
  mono = false,
  children,
}: {
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="min-w-0 px-3 py-2">
      <dt className="text-[9.5px] font-medium uppercase tracking-wider text-muted-dim">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-[11.5px] text-foreground",
          mono && "font-mono",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
