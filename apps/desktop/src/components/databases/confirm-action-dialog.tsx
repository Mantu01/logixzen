"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ConfirmActionType = "reset" | "uninstall";

interface ConfirmActionDialogProps {
  type: ConfirmActionType;
  engineName: string;
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isExecuting?: boolean;
}

export function ConfirmActionDialog({
  type,
  engineName,
  isOpen,
  onConfirm,
  onCancel,
  isExecuting = false,
}: ConfirmActionDialogProps): React.ReactElement | null {
  if (!isOpen) return null;

  const isReset = type === "reset";
  const title = isReset
    ? `Reset ${engineName} Practice Database?`
    : `Uninstall ${engineName}?`;
  const description = isReset
    ? "Resetting will automatically create a timestamped backup snapshot in your app directory, restore all 14 canonical practice tables to their original 373 rows, and leave all your custom tables and data intact."
    : "Uninstalling will stop the running service or container and unregister this engine from LogixZen. Your practice database and learner data will be kept intact in the application directory.";

  const confirmLabel = isReset
    ? "Reset Practice Database"
    : "Uninstall Engine (Keep Data)";
  const confirmVariant = isReset ? "default" : "destructive";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        className="flex w-full max-w-md flex-col gap-4 border border-border bg-surface p-5 text-[12px] shadow-lg"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center border border-warning/30 bg-warning/10 text-warning">
            <AlertTriangle className="size-4" />
          </div>
          <div>
            <h3
              id="confirm-action-title"
              className="text-[13.5px] font-semibold text-foreground"
            >
              {title}
            </h3>
            <p className="mt-1 text-[11.5px] text-muted leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isExecuting}
            className="border-border h-8 text-[11.5px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            size="sm"
            onClick={() => void onConfirm()}
            disabled={isExecuting}
            className="h-8 text-[11.5px] font-medium"
          >
            {isExecuting ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
