"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import type { EngineCatalogEntry, InstallationRecord } from "@/shared/engines";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/shared/format";

interface EngineDetailsDialogProps {
  record: InstallationRecord | null;
  entry: EngineCatalogEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EngineDetailsDialog({
  record,
  entry,
  isOpen,
  onClose,
}: EngineDetailsDialogProps): React.ReactElement {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <Dialog
      open={isOpen && record !== null && entry !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent
        showCloseButton
        className="max-h-[90vh] max-w-lg gap-0 overflow-y-auto p-5 text-[12px]"
      >
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Info className="size-4 shrink-0 text-primary" />
          <DialogTitle className="text-[13.5px] font-semibold">
            {entry?.displayName} — Technical Details
          </DialogTitle>
        </div>

        {record && entry ? (
          <>
            <div className="mt-4 divide-y divide-border border border-border font-mono text-[11.5px]">
              <div className="flex justify-between gap-4 bg-surface-alt/40 p-2.5">
                <span className="shrink-0 text-[10px] uppercase text-muted-dim">
                  Install Method
                </span>
                <span className="text-right text-foreground">{record.method}</span>
              </div>
              <div className="flex justify-between gap-4 p-2.5">
                <span className="shrink-0 text-[10px] uppercase text-muted-dim">
                  Version / Pin
                </span>
                <span className="text-right text-foreground">
                  {record.installedVersion ?? entry.pin}
                </span>
              </div>
              <div className="flex justify-between gap-4 bg-surface-alt/40 p-2.5">
                <span className="shrink-0 text-[10px] uppercase text-muted-dim">
                  Dialect
                </span>
                <span className="text-right uppercase text-foreground">
                  {entry.dialect}
                </span>
              </div>
              <div className="flex justify-between gap-4 p-2.5">
                <span className="shrink-0 text-[10px] uppercase text-muted-dim">
                  Target / Port
                </span>
                <span className="text-right text-foreground">
                  {record.port
                    ? `127.0.0.1:${record.port}`
                    : (record.instanceName ?? "Default")}
                </span>
              </div>
              <div className="flex justify-between gap-4 bg-surface-alt/40 p-2.5">
                <span className="shrink-0 text-[10px] uppercase text-muted-dim">
                  Install Location
                </span>
                <span className="break-all text-right text-foreground">
                  {record.dataLocation ?? "App Data Directory"}
                </span>
              </div>
              <div className="flex justify-between gap-4 p-2.5">
                <span className="shrink-0 text-[10px] uppercase text-muted-dim">
                  License
                </span>
                <span className="text-right text-foreground">{entry.license}</span>
              </div>
              <div className="flex justify-between gap-4 bg-surface-alt/40 p-2.5">
                <span className="shrink-0 text-[10px] uppercase text-muted-dim">
                  Installed Date
                </span>
                <span className="text-right text-foreground">
                  {formatDate(record.createdAt)}
                </span>
              </div>
              <div className="flex justify-between gap-4 p-2.5">
                <span className="shrink-0 text-[10px] uppercase text-muted-dim">
                  Last Verification
                </span>
                <span className="text-right text-foreground">
                  {record.lastVerification
                    ? formatDate(record.lastVerification.checkedAt)
                    : "Not verified"}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setAdvancedOpen((prev) => !prev)}
                className="flex items-center gap-1.5 py-1 font-mono text-[11px] text-muted transition-colors hover:text-foreground"
              >
                {advancedOpen ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                <span>Advanced Technical Identifiers</span>
              </button>

              {advancedOpen ? (
                <div className="mt-2 flex flex-col gap-1.5 border border-border bg-surface-alt/50 p-2.5 font-mono text-[10.5px] text-muted">
                  <div>
                    <span className="text-muted-dim">Option ID:</span>{" "}
                    {record.optionId}
                  </div>
                  {record.containerName ? (
                    <div>
                      <span className="text-muted-dim">Container:</span>{" "}
                      {record.containerName}
                    </div>
                  ) : null}
                  {record.resources.volume ? (
                    <div>
                      <span className="text-muted-dim">Volume:</span>{" "}
                      {record.resources.volume}
                    </div>
                  ) : null}
                  {record.resources.service ? (
                    <div>
                      <span className="text-muted-dim">Service:</span>{" "}
                      {record.resources.service}
                    </div>
                  ) : null}
                  {record.secretRef ? (
                    <div>
                      <span className="text-muted-dim">Secret Ref:</span>{" "}
                      {record.secretRef}
                    </div>
                  ) : null}
                  {entry.container?.image ? (
                    <div>
                      <span className="text-muted-dim">Image Ref:</span>{" "}
                      {entry.container.image}:{entry.container.tag}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
