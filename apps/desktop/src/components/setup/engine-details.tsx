"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Shield, AlertTriangle } from "lucide-react";
import type {
  EngineOffer,
  InstallationRecord,
  PlatformSnapshot,
} from "@/shared/engines";
import { platformOf } from "@/shared/engine-catalog";

interface EngineDetailsProps {
  offer: EngineOffer | null;
  snapshot: PlatformSnapshot | null;
  installation?: InstallationRecord;
}

export function EngineDetails({
  offer,
  snapshot,
  installation,
}: EngineDetailsProps): React.ReactElement {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!offer) {
    return (
      <div className="border border-border bg-surface p-4 text-[11.5px] text-muted-dim text-center">
        Select a database engine to review its details and requirements.
      </div>
    );
  }

  const { entry } = offer;
  const platform = snapshot ? platformOf(snapshot) : "windows-x64";
  const size =
    (platform && entry.sizes[platform]) ?? Object.values(entry.sizes)[0];
  const downloadBytes = size?.downloadBytes ?? 0;
  const installedBytes = size?.installedBytes ?? 0;

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 MB";
    if (bytes < 1024 * 1024 * 1024) {
      return `${Math.round(bytes / (1024 * 1024))} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const capabilitiesList: string[] = [];
  if (entry.capabilities.startStop) capabilitiesList.push("Start/Stop Service");
  if (entry.capabilities.backup) capabilitiesList.push("Backup & Restore");
  if (entry.capabilities.portConfig) capabilitiesList.push("Configurable Port");
  if (entry.capabilities.introspection)
    capabilitiesList.push("Schema Introspection");
  if (entry.capabilities.multipleInstances)
    capabilitiesList.push("Multiple Instances");

  return (
    <div className="border border-border bg-surface p-4 text-[11.5px] space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-[13px] text-foreground">
            {entry.displayName}
          </h3>
          <span className="text-[10.5px] text-muted-dim font-mono">
            {entry.pin}
          </span>
        </div>
        <p className="mt-1 text-muted text-[11.5px] leading-relaxed">
          {entry.purpose}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 border-y border-border py-3 text-[11px]">
        <div>
          <span className="text-muted-dim uppercase tracking-wider text-[10px]">
            Publisher
          </span>
          <div className="font-medium text-foreground mt-0.5">
            {entry.publisher}
          </div>
        </div>
        <div>
          <span className="text-muted-dim uppercase tracking-wider text-[10px]">
            Method
          </span>
          <div className="font-medium text-foreground capitalize mt-0.5">
            {entry.method}
          </div>
        </div>
        <div>
          <span className="text-muted-dim uppercase tracking-wider text-[10px]">
            Download Size
          </span>
          <div className="font-medium text-foreground font-mono mt-0.5">
            {formatSize(downloadBytes)}
          </div>
        </div>
        <div>
          <span className="text-muted-dim uppercase tracking-wider text-[10px]">
            Installed Disk
          </span>
          <div className="font-medium text-foreground font-mono mt-0.5">
            {formatSize(installedBytes)}
          </div>
        </div>
        <div>
          <span className="text-muted-dim uppercase tracking-wider text-[10px]">
            Min. Free Disk
          </span>
          <div className="font-medium text-foreground font-mono mt-0.5">
            {formatSize(entry.minDiskBytes ?? 0)}
          </div>
        </div>
        <div>
          <span className="text-muted-dim uppercase tracking-wider text-[10px]">
            Min. RAM
          </span>
          <div className="font-medium text-foreground font-mono mt-0.5">
            {formatSize(entry.minMemoryBytes ?? 0)}
          </div>
        </div>
      </div>

      <div>
        <span className="text-muted-dim uppercase tracking-wider text-[10px] block mb-1.5">
          Capabilities
        </span>
        <div className="flex flex-wrap gap-1.5">
          {capabilitiesList.map((cap) => (
            <span
              key={cap}
              className="border border-border bg-surface-alt px-1.5 py-0.5 text-[10.5px] text-muted"
            >
              {cap}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[10.5px] text-muted-dim">
        <Shield className="size-3 text-primary shrink-0" />
        <span>License: {entry.license}</span>
        {entry.elevation === "required" ? (
          <span className="ml-2 text-warning flex items-center gap-1">
            <AlertTriangle className="size-3" />
            Admin elevation required
          </span>
        ) : null}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          {showAdvanced ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          <span>Advanced Details</span>
        </button>

        {showAdvanced ? (
          <div className="mt-2.5 space-y-1.5 border border-border/80 bg-surface-alt/40 p-2.5 font-mono text-[10.5px] text-muted-dim">
            <div>
              Option ID: <span className="text-foreground">{entry.id}</span>
            </div>
            <div>
              Dialect: <span className="text-foreground">{entry.dialect}</span>
            </div>
            <div>
              Default Port:{" "}
              <span className="text-foreground">
                {entry.container?.port ??
                  (entry.dialect === "tsql"
                    ? 1433
                    : entry.dialect === "postgres"
                      ? 5432
                      : entry.dialect === "mysql"
                        ? 3306
                        : "N/A")}
              </span>
            </div>
            {entry.container ? (
              <>
                <div>
                  Container Image:{" "}
                  <span className="text-foreground">
                    {entry.container.image}:{entry.container.tag}
                  </span>
                </div>
                <div>
                  Digest:{" "}
                  <span className="text-foreground truncate block">
                    {entry.container.digest}
                  </span>
                </div>
                <div>
                  Volume:{" "}
                  <span className="text-foreground">
                    logixzen-{entry.id}-data
                  </span>
                </div>
              </>
            ) : null}
            {installation ? (
              <div className="pt-1.5 border-t border-border mt-1.5">
                <div>
                  Installed Status:{" "}
                  <span className="text-foreground">{installation.status}</span>
                </div>
                {installation.port ? (
                  <div>
                    Allocated Port:{" "}
                    <span className="text-foreground">{installation.port}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
