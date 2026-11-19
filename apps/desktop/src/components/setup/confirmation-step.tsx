"use client";

import { Download, HardDrive, Box, Folder, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EngineOffer, PlatformSnapshot } from "@/shared/engines";
import { platformOf } from "@/shared/engine-catalog";

interface ConfirmationStepProps {
  selectedOffers: EngineOffer[];
  snapshot: PlatformSnapshot | null;
  onConfirm: () => void;
  onBack: () => void;
  isExecuting?: boolean;
}

export function ConfirmationStep({
  selectedOffers,
  snapshot,
  onConfirm,
  onBack,
  isExecuting = false,
}: ConfirmationStepProps): React.ReactElement {
  let totalDownloadBytes = 0;
  let totalDiskBytes = 0;
  let elevationNeeded = false;
  const containerList: string[] = [];
  const localList: string[] = [];
  const portList: string[] = [];

  const platform = snapshot ? platformOf(snapshot) : "windows-x64";

  for (const offer of selectedOffers) {
    const { entry } = offer;
    const size =
      (platform && entry.sizes[platform]) ?? Object.values(entry.sizes)[0];
    totalDownloadBytes += size?.downloadBytes ?? 0;
    totalDiskBytes += size?.installedBytes ?? entry.minDiskBytes ?? 0;
    if (entry.elevation === "required") elevationNeeded = true;
    if (entry.method === "container") {
      containerList.push(`logixzen-${entry.id}`);
      if (entry.container?.port) {
        portList.push(`127.0.0.1:${entry.container.port}`);
      }
    } else {
      localList.push(entry.displayName);
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 MB";
    if (bytes < 1024 * 1024 * 1024) {
      return `${Math.round(bytes / (1024 * 1024))} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto text-[11.5px]">
      <div className="border border-border bg-surface p-4 space-y-4">
        <div>
          <h2 className="text-[13.5px] font-semibold text-foreground">
            Review & Confirm Installation
          </h2>
          <p className="mt-1 text-muted text-[11.5px]">
            LogixZen will configure the following engines and practice
            environments on your machine.
          </p>
        </div>

        <div className="divide-y divide-border border-y border-border">
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2 text-muted">
              <Download className="size-3.5 text-primary shrink-0" />
              <span>Total Download</span>
            </div>
            <span className="font-mono font-medium text-foreground">
              {formatSize(totalDownloadBytes)}
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2 text-muted">
              <HardDrive className="size-3.5 text-primary shrink-0" />
              <span>Installed Disk Space Required</span>
            </div>
            <span className="font-mono font-medium text-foreground">
              {formatSize(totalDiskBytes)}
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2 text-muted">
              <Folder className="size-3.5 text-primary shrink-0" />
              <span>Practice Data Location</span>
            </div>
            <span className="font-mono text-foreground text-[10.5px]">
              Application Data / data / practice
            </span>
          </div>

          {containerList.length > 0 ? (
            <div className="py-2.5 space-y-1">
              <div className="flex items-center gap-2 text-muted">
                <Box className="size-3.5 text-primary shrink-0" />
                <span>Containers to be created</span>
              </div>
              <div className="font-mono text-[10.5px] text-foreground pl-5.5">
                {containerList.join(", ")}
              </div>
              {portList.length > 0 ? (
                <div className="text-[10px] text-muted-dim pl-5.5">
                  Loopback ports bound to: {portList.join(", ")}
                </div>
              ) : null}
            </div>
          ) : null}

          {elevationNeeded ? (
            <div className="flex items-start gap-2 py-2.5 text-warning">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">
                  Administrator permission required
                </span>
                <p className="text-[10.5px] text-muted mt-0.5">
                  One of your selected engines requires system administrator
                  elevation to register Windows services. You will be prompted
                  once.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="text-[11px] text-muted-dim">
          Selected engines:{" "}
          <span className="font-medium text-foreground">
            {selectedOffers.map((o) => o.entry.displayName).join(", ")}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          disabled={isExecuting}
          className="border-border h-8 text-[11px]"
        >
          Back to Selection
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={onConfirm}
          disabled={isExecuting || selectedOffers.length === 0}
          className="h-8 text-[11.5px] px-4 font-medium"
        >
          {isExecuting ? "Preparing..." : "Confirm & Install"}
        </Button>
      </div>
    </div>
  );
}
