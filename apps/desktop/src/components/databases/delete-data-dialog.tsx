"use client";

import { useState } from "react";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DeleteDataDialogProps {
  engineName: string;
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isExecuting?: boolean;
}

const CONFIRMATION_PHRASE = "DELETE DATA";

export function DeleteDataDialog({
  engineName,
  isOpen,
  onConfirm,
  onCancel,
  isExecuting = false,
}: DeleteDataDialogProps): React.ReactElement | null {
  const [inputVal, setInputVal] = useState("");

  if (!isOpen) return null;

  const matches = inputVal.trim() === CONFIRMATION_PHRASE;

  const handleClose = (): void => {
    setInputVal("");
    onCancel();
  };

  const handleConfirm = async (): Promise<void> => {
    if (!matches || isExecuting) return;
    await onConfirm();
    setInputVal("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-data-title"
        className="flex w-full max-w-md flex-col gap-4 border border-destructive/50 bg-surface p-5 text-[12px] shadow-lg"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center border border-destructive/30 bg-destructive/10 text-destructive">
            <AlertOctagon className="size-4" />
          </div>
          <div>
            <h3
              id="delete-data-title"
              className="text-[13.5px] font-semibold text-foreground"
            >
              Permanently Delete {engineName} Data?
            </h3>
            <p className="mt-1 text-[11.5px] text-muted leading-relaxed">
              This will permanently delete the practice database and any
              learner-created tables or records for this engine. This action
              cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 pt-1">
          <label
            htmlFor="confirm-input"
            className="block text-[11px] text-muted"
          >
            Type{" "}
            <span className="font-mono font-semibold text-destructive">
              {CONFIRMATION_PHRASE}
            </span>{" "}
            to confirm data deletion:
          </label>
          <Input
            id="confirm-input"
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={CONFIRMATION_PHRASE}
            className="border-border font-mono text-[12px] h-8.5"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isExecuting}
            className="border-border h-8 text-[11.5px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={!matches || isExecuting}
            className="h-8 text-[11.5px] font-medium"
          >
            {isExecuting ? "Deleting..." : "Permanently Delete Data"}
          </Button>
        </div>
      </div>
    </div>
  );
}
