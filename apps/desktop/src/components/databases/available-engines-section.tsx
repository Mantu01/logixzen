"use client";

import Link from "next/link";
import { Plus, Download } from "lucide-react";
import type { EngineOffer, PlatformSnapshot } from "@/shared/engines";
import { platformOf } from "@/shared/engine-catalog";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/shared/format";

interface AvailableEnginesSectionProps {
  availableOffers: EngineOffer[];
  snapshot: PlatformSnapshot | null;
}

export function AvailableEnginesSection({
  availableOffers,
  snapshot,
}: AvailableEnginesSectionProps): React.ReactElement | null {
  if (availableOffers.length === 0) return null;

  const currentPlatform = snapshot ? platformOf(snapshot) : "windows-x64";

  return (
    <div className="border border-border bg-surface text-[12px]">
      <div className="flex items-center justify-between border-b border-border p-3.5">
        <div>
          <h2 className="text-[13px] font-semibold text-foreground">
            Available to Install
          </h2>
          <p className="text-[11.5px] text-muted">
            Engines compatible with your current hardware and operating system.
          </p>
        </div>

        <Button
          asChild
          size="sm"
          className="h-7 text-[11px] gap-1.5"
        >
          <Link href="/setup">
            <Plus className="size-3" />
            <span>Open Engine Setup</span>
          </Link>
        </Button>
      </div>

      <div className="divide-y divide-border">
        {availableOffers.map((offer) => {
          const { entry } = offer;
          const size =
            (currentPlatform && entry.sizes[currentPlatform]) ??
            Object.values(entry.sizes)[0];
          const downloadBytes = size?.downloadBytes ?? 0;
          const diskBytes = size?.installedBytes ?? entry.minDiskBytes ?? 0;

          return (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-surface-alt/30 transition-colors"
            >
              <div className="space-y-0.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-[12.5px]">
                    {entry.displayName}
                  </span>
                  <span className="border border-border bg-surface-alt px-1.5 py-0.2 text-[9.5px] uppercase font-mono text-muted">
                    {entry.method}
                  </span>
                  <span className="text-[10.5px] font-mono text-muted-dim uppercase">
                    {entry.dialect}
                  </span>
                </div>
                <p className="text-[11px] text-muted">{entry.purpose}</p>
                <div className="flex items-center gap-3 text-[10.5px] font-mono text-muted-dim pt-0.5">
                  <span>Download: {formatBytes(downloadBytes)}</span>
                  <span>•</span>
                  <span>Disk required: {formatBytes(diskBytes)}</span>
                </div>
              </div>

              <div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-border h-7 text-[11px] gap-1"
                >
                  <Link href={`/setup?preselect=${entry.id}`}>
                    <Download className="size-3" />
                    <span>Install...</span>
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
