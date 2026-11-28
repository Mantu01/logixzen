"use client";

import {
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Download,
  FileJson,
  Loader2,
  Search,
  TableProperties,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SqlResult } from "@/shared/desktop-api";
import { cn } from "@/lib/utils";

interface ResultPanelProps {
  result: SqlResult | null;
  error?: string;
  isLoading?: boolean;
  fontSize?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onExportCsv: (result: SqlResult) => void;
  onExportJson: (result: SqlResult) => void;
  onCopy: (result: SqlResult) => void;
}

const VIRTUAL_ROW_HEIGHT = 28;
const VIRTUAL_THRESHOLD = 100;
const OVERSCAN = 12;
const INDEX_COL_WIDTH = 48;
const MIN_COL_WIDTH = 72;
const MAX_COL_WIDTH = 900;

function defaultColumnWidth(name: string): number {
  return Math.min(260, Math.max(120, name.length * 9 + 40));
}

export function PlaygroundResultPanel({
  result,
  error,
  isLoading,
  fontSize = 12,
  collapsed = false,
  onToggleCollapse,
  onExportCsv,
  onExportJson,
  onCopy,
}: ResultPanelProps): React.ReactElement {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(320);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cleanupDragRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupDragRef.current?.();
    };
  }, []);

  const columns: string[] = useMemo(() => result?.columns ?? [], [result]);

  const rows = useMemo(() => {
    const sourceRows: Record<string, unknown>[] = result?.rows ?? [];
    if (searchTerm === "") return sourceRows;
    const lowered = searchTerm.toLowerCase();
    return sourceRows.filter((row) =>
      columns.some((column) =>
        String(row[column] ?? "")
          .toLowerCase()
          .includes(lowered),
      ),
    );
  }, [result, columns, searchTerm]);

  const useVirtual = rows.length > VIRTUAL_THRESHOLD;
  const startIndex = useVirtual
    ? Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - OVERSCAN)
    : 0;
  const endIndex = useVirtual
    ? Math.min(
        rows.length,
        Math.ceil((scrollTop + viewportHeight) / VIRTUAL_ROW_HEIGHT) +
          OVERSCAN,
      )
    : rows.length;
  const visibleRows = rows.slice(startIndex, endIndex);
  const topSpacer = useVirtual ? startIndex * VIRTUAL_ROW_HEIGHT : 0;
  const bottomSpacer = useVirtual
    ? Math.max(0, (rows.length - endIndex) * VIRTUAL_ROW_HEIGHT)
    : 0;

  const executionTime =
    result?.executionTimeMs !== undefined
      ? `${result.executionTimeMs.toFixed(2)} ms`
      : null;

  const hasGrid =
    !isLoading &&
    error === undefined &&
    result !== null &&
    (result.isSelect || result.rows.length > 0);

  const getColumnWidth = (column: string): number =>
    columnWidths[column] ?? defaultColumnWidth(column);

  const totalTableWidth = useMemo(
    () =>
      INDEX_COL_WIDTH +
      columns.reduce(
        (sum, column) =>
          sum + (columnWidths[column] ?? defaultColumnWidth(column)),
        0,
      ),
    [columns, columnWidths],
  );

  const startResize = (
    event: React.PointerEvent<HTMLDivElement>,
    column: string,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    cleanupDragRef.current?.();

    const th = event.currentTarget.closest("th");
    const initialWidth =
      th !== null ? th.getBoundingClientRect().width : getColumnWidth(column);
    const startX = event.clientX;
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMove = (moveEvent: PointerEvent): void => {
      const nextWidth = Math.min(
        MAX_COL_WIDTH,
        Math.max(MIN_COL_WIDTH, Math.round(initialWidth + moveEvent.clientX - startX)),
      );
      setColumnWidths((prev) =>
        prev[column] === nextWidth ? prev : { ...prev, [column]: nextWidth },
      );
    };

    const cleanup = (): void => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", cleanup);
      document.removeEventListener("pointercancel", cleanup);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      cleanupDragRef.current = null;
    };

    cleanupDragRef.current = cleanup;
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", cleanup);
    document.addEventListener("pointercancel", cleanup);
  };

  const resetColumnWidth = (column: string): void => {
    setColumnWidths((prev) => {
      if (!(column in prev)) return prev;
      const next = { ...prev };
      delete next[column];
      return next;
    });
  };

  const summaryBadge = isLoading ? (
    <span className="flex items-center gap-1 font-mono text-[10px] text-primary">
      <Loader2 className="size-3 animate-spin" />
      Running
    </span>
  ) : error !== undefined ? (
    <span className="border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] text-destructive">
      Error
    </span>
  ) : result === null ? (
    <span className="font-mono text-[10px] text-muted-dim">Idle</span>
  ) : result.rows.length === 0 && !result.isSelect ? (
    <span className="numeric border border-success/40 bg-success/10 px-1.5 py-0.5 font-mono text-[10px] text-success">
      {result.rowsAffected ?? 0} affected
    </span>
  ) : (
    <div className="numeric flex items-center gap-1.5 font-mono text-[10px]">
      <span className="border border-border bg-surface-alt px-1.5 py-0.5 text-foreground">
        {rows.length} {rows.length === 1 ? "row" : "rows"} · {columns.length}{" "}
        {columns.length === 1 ? "col" : "cols"}
      </span>
      {useVirtual ? (
        <span className="text-muted-dim">
          showing {startIndex + 1}–{endIndex}
        </span>
      ) : null}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-surface px-2.5">
        {onToggleCollapse ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={collapsed ? "Expand results" : "Collapse results"}
                aria-expanded={!collapsed}
                className="flex h-6 items-center gap-1.5 px-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-dim transition-colors hover:text-foreground"
              >
                {collapsed ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
                <span>Results</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {collapsed ? "Expand results" : "Collapse results"}
              <kbd className="ml-1.5 border border-background/25 px-1 py-px font-mono text-[9px] text-background/85">
                Ctrl+J
              </kbd>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-dim">
            Results
          </span>
        )}

        {summaryBadge}

        {executionTime !== null && !isLoading ? (
          <span className="numeric font-mono text-[10px] text-muted-dim">
            {executionTime}
          </span>
        ) : null}

        {!collapsed && hasGrid && result ? (
          <>
            <div className="relative ml-auto">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-dim" />
              <Input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setScrollTop(0);
                  if (containerRef.current) containerRef.current.scrollTop = 0;
                }}
                placeholder="Filter rows"
                aria-label="Filter result rows"
                className="h-6 w-44 bg-surface-alt/40 pl-7 text-[11px]"
              />
            </div>

            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => onCopy(result)}
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Copy results as CSV"
                    className="text-muted"
                  >
                    <ClipboardCopy />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy as CSV</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => onExportCsv(result)}
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Export CSV"
                    className="text-muted"
                  >
                    <Download />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export CSV</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => onExportJson(result)}
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Export JSON"
                    className="text-muted"
                  >
                    <FileJson />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export JSON</TooltipContent>
              </Tooltip>
            </div>
          </>
        ) : null}
      </div>

      {collapsed ? null : isLoading ? (
        <div className="flex flex-1 items-center justify-center gap-2.5 text-[13px] text-muted">
          <Loader2 className="size-4 animate-spin text-primary" />
          Executing query…
        </div>
      ) : error !== undefined ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <Alert variant="destructive" className="border-error/30 bg-error/8">
            <AlertDescription className="font-mono text-[12px] leading-relaxed">
              {error}
            </AlertDescription>
          </Alert>
        </div>
      ) : result === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="flex size-9 items-center justify-center border border-border bg-surface-alt/60">
            <TableProperties className="size-4 text-muted-dim" />
          </span>
          <p className="text-[12.5px] font-medium text-muted">No results yet</p>
          <p className="max-w-xs text-[11px] leading-relaxed text-muted-dim">
            Run a query with Ctrl+Enter or F5 to view tabular output.
          </p>
        </div>
      ) : result.rows.length === 0 && !result.isSelect ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center">
          <p className="text-[13px] font-medium text-success">
            {result.message ?? "Statement executed"}
          </p>
          <p className="numeric text-[11px] text-muted-dim">
            {result.rowsAffected ?? 0} row
            {(result.rowsAffected ?? 0) === 1 ? "" : "s"} affected
            {executionTime ? ` · ${executionTime}` : ""}
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={(event) => {
            const el = event.currentTarget;
            setScrollTop(el.scrollTop);
            if (el.clientHeight !== viewportHeight) {
              setViewportHeight(el.clientHeight);
            }
          }}
          className="min-h-0 flex-1 overflow-auto bg-surface"
        >
          <Table
            noWrapper
            className="min-w-full table-fixed border-collapse font-mono"
            style={{ width: totalTableWidth, fontSize }}
          >
            <colgroup>
              <col style={{ width: INDEX_COL_WIDTH }} />
              {columns.map((column) => (
                <col key={column} style={{ width: getColumnWidth(column) }} />
              ))}
            </colgroup>
            <TableHeader className="sticky top-0 z-10 bg-surface-alt">
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="h-8 border-r border-border px-2 text-right font-mono text-[10px] font-medium text-muted-dim">
                  #
                </TableHead>
                {columns.map((column) => (
                  <TableHead
                    key={column}
                    className="group relative h-8 select-none border-r border-border px-2.5 text-left font-medium text-foreground last:border-r-0"
                    style={{ fontSize: Math.max(10, fontSize - 1) }}
                  >
                    <span className="block truncate pr-2">{column}</span>
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${column} column`}
                      onPointerDown={(event) => startResize(event, column)}
                      onDoubleClick={() => resetColumnWidth(column)}
                      className="absolute bottom-0 right-0 top-0 w-1.5 cursor-col-resize transition-colors hover:bg-primary/60"
                    />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {topSpacer > 0 ? (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length + 1}
                    style={{ height: topSpacer, padding: 0 }}
                  />
                </TableRow>
              ) : null}
              {visibleRows.map((row, offset) => {
                const rowNumber = startIndex + offset + 1;
                return (
                  <TableRow
                    key={rowNumber}
                    className="border-b border-border/70 odd:bg-surface even:bg-surface-alt/25 hover:bg-surface-hover/70"
                    style={
                      useVirtual ? { height: VIRTUAL_ROW_HEIGHT } : undefined
                    }
                  >
                    <TableCell className="numeric border-r border-border/70 px-2 py-1 text-right text-[10px] text-muted-dim">
                      {rowNumber}
                    </TableCell>
                    {columns.map((column) => {
                      const value = row[column];
                      const isNull = value === null || value === undefined;
                      const display = isNull ? "NULL" : String(value);
                      return (
                        <TableCell
                          key={column}
                          className={cn(
                            "truncate border-r border-border/70 px-2.5 py-1 last:border-r-0",
                            typeof value === "number" && "numeric",
                          )}
                        >
                          {isNull ? (
                            <span className="border border-border bg-surface-alt px-1 py-px text-[9.5px] uppercase tracking-wider text-muted-dim">
                              NULL
                            </span>
                          ) : display.length > 32 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate">{display}</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md break-all font-mono text-[11px]">
                                {display}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="block truncate">{display}</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
              {bottomSpacer > 0 ? (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length + 1}
                    style={{ height: bottomSpacer, padding: 0 }}
                  />
                </TableRow>
              ) : null}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="py-8 text-center text-muted"
                  >
                    {result.rows.length === 0
                      ? "Query returned no rows"
                      : "No rows match the filter"}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
