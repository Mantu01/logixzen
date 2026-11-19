"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useSqlStore } from "@/sql/useSqlStore";
import { usePackStore } from "@/stores/usePackStore";
import type { ProgressEvent } from "@/shared/engines";
import { cn } from "@/lib/utils";

export function StatusBar(): React.ReactElement {
  const schema = useSqlStore((state) => state.schema);
  const activeDatasetId = useSqlStore((state) => state.activeDatasetId);
  const isInitialized = useSqlStore((state) => state.isInitialized);
  const activeEngineName = useSqlStore((state) => state.activeEngineName);
  const activeDialect = useSqlStore((state) => state.activeDialect);
  const connectionStatus = useSqlStore((state) => state.connectionStatus);
  const autoConnect = useSqlStore((state) => state.autoConnect);

  const databases = usePackStore((state) => state.databases);
  const activeName = databases.find(
    (item) => item.id === activeDatasetId,
  )?.name;
  const tables = schema.length;

  const [activeJobEvent, setActiveJobEvent] = useState<ProgressEvent | null>(
    null,
  );

  useEffect(() => {
    void autoConnect();
  }, [autoConnect]);

  useEffect(() => {
    const bridge = window.logixzen?.setup;
    if (!bridge) return;

    const unsubscribe = bridge.subscribeProgress((evt: ProgressEvent) => {
      setActiveJobEvent(evt);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const isConnecting = connectionStatus === "connecting";
  const isReady = connectionStatus === "ready" && isInitialized;
  const isFailed =
    connectionStatus === "failed" || connectionStatus === "needs-repair";

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between gap-4 border-t border-border bg-titlebar px-3 text-[10.5px] text-muted-dim font-mono">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex items-center gap-1.5 font-sans">
          <span
            className={cn(
              "size-1.5 shrink-0",
              isReady
                ? "bg-success"
                : isConnecting
                  ? "bg-primary animate-pulse"
                  : isFailed
                    ? "bg-destructive"
                    : "bg-muted-dim",
            )}
            aria-hidden="true"
          />
          <span className="font-medium text-foreground">
            {activeEngineName}
          </span>
          <span className="text-[9.5px] uppercase text-muted-dim">
            ({activeDialect})
          </span>
        </span>

        <span className="text-muted border-l border-border pl-3">
          {activeName ?? "LogixZenPractice"}
        </span>

        <span className="numeric text-muted-dim">{tables} tables</span>

        {isFailed ? (
          <Link
            href="/databases"
            className="flex items-center gap-1 text-destructive hover:underline border-l border-border pl-3"
          >
            <AlertTriangle className="size-2.5" />
            <span>Connection issue — Repair in Databases</span>
          </Link>
        ) : null}

        {activeJobEvent && activeJobEvent.activity ? (
          <Link
            href="/databases"
            className="flex items-center gap-1.5 text-primary hover:underline border-l border-border pl-3"
          >
            <Loader2 className="size-2.5 animate-spin" />
            <span className="truncate max-w-48">{activeJobEvent.activity}</span>
          </Link>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <span className="numeric text-[10px]">LogixZen v0.1.0</span>
      </div>
    </footer>
  );
}
