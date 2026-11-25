"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { EngineOffer, PlatformSnapshot } from "@/shared/engines";
import { platformOf } from "@/shared/engine-catalog";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app-shell/panel";
import { StatusChip } from "@/components/ui/status-chip";
import { formatBytes } from "@/shared/format";
import { methodLabel } from "@/lib/engine-status";

interface AvailableEnginesSectionProps {
  availableOffers: EngineOffer[];
  snapshot: PlatformSnapshot | null;
}

export function AvailableEnginesSection({
  availableOffers,
  snapshot,
}: AvailableEnginesSectionProps): React.ReactElement | null {
  if (availableOffers.length === 0) return null;

  const platform = snapshot ? platformOf(snapshot) : null;

  return (
    <Panel
      title="Available to install"
      description="Engines compatible with this machine."
      actions={
        <Button asChild size="sm" className="h-7 gap-1.5 px-2 text-[11px]">
          <Link href="/setup">
            <Plus className="size-3" />
            Engine setup
          </Link>
        </Button>
      }
    >
      <ul className="divide-y divide-border">
        {availableOffers.map(({ entry }) => {
          const size =
            (platform ? entry.sizes[platform] : undefined) ??
            Object.values(entry.sizes)[0] ??
            null;
          return (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 hover:bg-surface-alt/40"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold text-foreground">
                    {entry.displayName}
                  </span>
                  <StatusChip>{methodLabel(entry.method)}</StatusChip>
                  <span className="font-mono text-[10px] uppercase text-muted-dim">
                    {entry.dialect}
                  </span>
                </div>
                <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-muted">
                  {entry.purpose}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-dim">
                  {size ? `${formatBytes(size.downloadBytes)} download` : "Bundled"} ·{" "}
                  {formatBytes(entry.minDiskBytes ?? 0)} disk · {entry.license}
                </p>
              </div>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-7 border-border px-2 text-[11px]"
              >
                <Link href={`/setup?preselect=${entry.id}`}>Install</Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
