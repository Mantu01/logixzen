"use client";

import { useEffect, useState } from "react";
import { Copy, RefreshCw, Terminal, X, Check } from "lucide-react";
import type { EngineOptionId } from "@/shared/engines";
import { Button } from "@/components/ui/button";

interface ContainerLogsDialogProps {
  optionId: EngineOptionId | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ContainerLogsDialog({
  optionId,
  isOpen,
  onClose,
}: ContainerLogsDialogProps): React.ReactElement | null {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !optionId) return;
    let active = true;
    const run = async (): Promise<void> => {
      if (
        typeof window === "undefined" ||
        !window.logixzen?.setup?.containerLogs
      )
        return;
      try {
        const res = await window.logixzen.setup.containerLogs(optionId, 100);
        if (active && res.ok) {
          setLogs(res.data);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [isOpen, optionId]);

  const fetchLogs = async (): Promise<void> => {
    if (
      !optionId ||
      typeof window === "undefined" ||
      !window.logixzen?.setup?.containerLogs
    )
      return;
    setLoading(true);
    try {
      const res = await window.logixzen.setup.containerLogs(optionId, 100);
      if (res.ok) {
        setLogs(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !optionId) return null;

  const handleCopy = async (): Promise<void> => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(logs.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="container-logs-title"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-3 border border-border bg-surface p-5 text-[12px] shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="size-4 text-primary shrink-0" />
            <h3
              id="container-logs-title"
              className="text-[13.5px] font-semibold text-foreground"
            >
              Container Logs — {optionId}
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="border-border h-7 text-[11px] gap-1"
            >
              {copied ? (
                <Check className="size-3 text-success" />
              ) : (
                <Copy className="size-3" />
              )}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchLogs()}
              disabled={loading}
              className="border-border h-7 text-[11px] gap-1"
            >
              <RefreshCw
                className={loading ? "size-3 animate-spin" : "size-3"}
              />
              <span>Refresh</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close logs"
              className="text-muted hover:text-foreground p-1 transition-colors ml-1"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-[300px] border border-border bg-black/80 p-3 font-mono text-[11px] text-green-400 overflow-y-auto whitespace-pre-wrap select-text leading-tight">
          {logs.length === 0 ? (
            <span className="text-muted">No log entries captured yet.</span>
          ) : (
            logs.map((line, idx) => <div key={idx}>{line}</div>)
          )}
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border shrink-0 text-[11px] text-muted font-mono">
          <span>
            Showing latest {logs.length} lines (passwords and tokens redacted)
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-border h-7 text-[11px]"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
