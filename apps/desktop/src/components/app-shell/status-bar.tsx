"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useSqlStore } from "@/sql/useSqlStore";
import { usePackStore } from "@/stores/usePackStore";
import type { ProgressEvent } from "@/shared/engines";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const APP_VERSION = "0.1.0";

export function StatusBar(): React.ReactElement {
  const schema = useSqlStore((state) => state.schema);
  const activeDatasetId = useSqlStore((state) => state.activeDatasetId);
  const isInitialized = useSqlStore((state) => state.isInitialized);
  const activeEngineName = useSqlStore((state) => state.activeEngineName);
  const activeDialect = useSqlStore((state) => state.activeDialect);
  const connectionStatus = useSqlStore((state) => state.connectionStatus);
  const hasEngine = useSqlStore((state) => state.engineInstalled);
  const autoConnect = useSqlStore((state) => state.autoConnect);

  const databases = usePackStore((state) => state.databases);
  const datasetName = databases.find(
    (item) => item.id === activeDatasetId,
  )?.name;

  const [activeJobEvent, setActiveJobEvent] = useState<ProgressEvent | null>(
    null,
  );

  useEffect(() => {
    void autoConnect();
  }, [autoConnect]);

  useEffect(() => {
    const bridge = window.logixzen?.setup;
    if (!bridge) return;
    return bridge.subscribeProgress(setActiveJobEvent);
  }, []);

  const isConnecting = connectionStatus === "connecting";
  const isReady = connectionStatus === "ready" && isInitialized;
  const isFailed =
    connectionStatus === "failed" || connectionStatus === "needs-repair";
  const jobRunning =
    activeJobEvent !== null &&
    (activeJobEvent.status === "running" ||
      activeJobEvent.status === "queued" ||
      activeJobEvent.status === "waiting-for-user");

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between gap-4 border-t border-border bg-titlebar px-3 font-mono text-[10.5px] text-muted-dim">
      <div className="flex min-w-0 items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex min-w-0 items-center gap-1.5">
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
              <span className="truncate font-sans font-medium text-foreground">
                {activeEngineName}
              </span>
              {hasEngine ? (
                <span className="uppercase tracking-wide">{activeDialect}</span>
              ) : null}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isReady
              ? `Connected to ${activeEngineName} (${activeDialect})`
              : isConnecting
                ? `Connecting to ${activeEngineName}...`
                : isFailed
                  ? `${activeEngineName} needs attention — open Databases to verify or repair`
                  : "No active engine running"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="border-l border-border pl-3 text-muted">
              {datasetName ?? "practice"}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            Active database schema in practice workspace
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="numeric">{schema.length} tables</span>
          </TooltipTrigger>
          <TooltipContent side="top">
            Tables detected in active database
          </TooltipContent>
        </Tooltip>

        {isFailed && hasEngine ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/databases"
                className="flex items-center gap-1 border-l border-border pl-3 text-destructive hover:underline"
              >
                <AlertTriangle className="size-2.5" />
                Repair in Databases
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">
              Open Databases to diagnose and repair engine connection
            </TooltipContent>
          </Tooltip>
        ) : null}

        {!hasEngine ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/setup"
                className="flex items-center gap-1 border-l border-border pl-3 text-warning hover:underline"
              >
                <AlertTriangle className="size-2.5" />
                Install an engine
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">
              Install a local SQL engine to execute queries
            </TooltipContent>
          </Tooltip>
        ) : null}

        {jobRunning && activeJobEvent ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/databases"
                className="flex min-w-0 items-center gap-1.5 border-l border-border pl-3 text-primary hover:underline"
              >
                <Loader2 className="size-2.5 shrink-0 animate-spin" />
                <span className="max-w-56 truncate">
                  {activeJobEvent.activity}
                </span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">
              Background setup job running — click to view progress
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="numeric">v{APP_VERSION}</span>
          </TooltipTrigger>
          <TooltipContent side="top">LogixZen Desktop v{APP_VERSION}</TooltipContent>
        </Tooltip>
      </div>
    </footer>
  );
}
