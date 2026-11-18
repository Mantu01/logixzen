"use client";

import { Check, Database, Box, Package } from "lucide-react";
import type {
  EngineOffer,
  InstallationRecord,
  PlatformSnapshot,
} from "@/shared/engines";
import { platformOf } from "@/shared/engine-catalog";
import { cn } from "@/lib/utils";

interface EngineCardProps {
  offer: EngineOffer;
  snapshot: PlatformSnapshot | null;
  installation?: InstallationRecord;
  selected: boolean;
  active: boolean;
  onToggleSelect: (optionId: string) => void;
  onHighlight: (optionId: string) => void;
}

export function EngineCard({
  offer,
  snapshot,
  installation,
  selected,
  active,
  onToggleSelect,
  onHighlight,
}: EngineCardProps): React.ReactElement {
  const { entry } = offer;
  const isRecommended = entry.recommended;

  const status = installation?.status ?? "not-installed";
  const statusLabel =
    status === "ready"
      ? "Installed"
      : status === "detected"
        ? "Detected"
        : status === "needs-repair"
          ? "Needs repair"
          : "Not installed";

  const statusColor =
    status === "ready"
      ? "text-success border-success/30 bg-success/10"
      : status === "detected"
        ? "text-primary border-primary/30 bg-primary/10"
        : status === "needs-repair"
          ? "text-warning border-warning/30 bg-warning/10"
          : "text-muted-dim border-border bg-surface-alt/50";

  const methodIcon =
    entry.method === "bundled" ? (
      <Package className="size-3.5 text-primary shrink-0" />
    ) : entry.method === "container" ? (
      <Box className="size-3.5 text-primary shrink-0" />
    ) : (
      <Database className="size-3.5 text-primary shrink-0" />
    );

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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onHighlight(entry.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleSelect(entry.id);
        }
      }}
      className={cn(
        "group relative flex flex-col justify-between border p-3.5 text-left transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary",
        active
          ? "border-primary/60 bg-surface-hover/80"
          : "border-border bg-surface hover:bg-surface-hover/50",
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {methodIcon}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-[12.5px] text-foreground truncate">
                  {entry.displayName}
                </span>
                {isRecommended ? (
                  <span className="border border-primary/40 bg-primary/10 px-1 py-0.2 text-[9.5px] font-medium uppercase tracking-wider text-primary">
                    Recommended
                  </span>
                ) : null}
              </div>
              <span className="text-[10.5px] text-muted-dim">
                {entry.publisher}
              </span>
            </div>
          </div>

          <button
            type="button"
            aria-label={`Select ${entry.displayName}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(entry.id);
            }}
            className={cn(
              "flex size-4 shrink-0 items-center justify-center border transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface group-hover:border-primary/50",
            )}
          >
            {selected ? <Check className="size-3" /> : null}
          </button>
        </div>

        <p className="text-[11.5px] text-muted leading-relaxed line-clamp-2">
          {entry.purpose}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[10.5px]">
        <div className="flex items-center gap-3 text-muted-dim">
          <span>
            DL:{" "}
            <span className="font-mono text-foreground">
              {formatSize(downloadBytes)}
            </span>
          </span>
          <span>
            Disk:{" "}
            <span className="font-mono text-foreground">
              {formatSize(installedBytes)}
            </span>
          </span>
        </div>

        <span
          className={cn(
            "border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            statusColor,
          )}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
