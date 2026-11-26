"use client";

import {
  ArrowDown,
  ArrowUp,
  ClipboardCopy,
  Download,
  FileJson,
  Loader2,
  Search,
  TableProperties,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
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

interface ResultPanelProps {
  result: SqlResult | null;
  error?: string;
  isLoading?: boolean;
  fontSize?: number;
  onExportCsv: (result: SqlResult) => void;
  onExportJson: (result: SqlResult) => void;
  onCopy: (result: SqlResult) => void;
}

type SortDirection = "asc" | "desc" | null;

const VIRTUAL_ROW_HEIGHT = 29;
const VIRTUAL_THRESHOLD = 100;
const OVERSCAN = 12;

export function PlaygroundResultPanel({
  result,
  error,
  isLoading,
  fontSize = 12,
  onExportCsv,
  onExportJson,
  onCopy,
}: ResultPanelProps): React.ReactElement {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(320);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const columns: string[] = result?.columns ?? [];

  const rows = useMemo(() => {
    const sourceRows: Record<string, unknown>[] = result?.rows ?? [];
    const tableColumns: string[] = result?.columns ?? [];
    const filtered =
      searchTerm === ""
        ? sourceRows
        : sourceRows.filter((row) =>
            tableColumns.some((column) =>
              String(row[column] ?? "")
                .toLowerCase()
                .includes(searchTerm.toLowerCase()),
            ),
          );

    if (sortColumn === null || sortDir === null) return filtered;

    const direction = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) => {
      const a = left[sortColumn];
      const b = right[sortColumn];
      if (a === b) return 0;
      if (a === null || a === undefined) return 1;
      if (b === null || b === undefined) return -1;
      const numA = typeof a === "number" ? a : Number(a);
      const numB = typeof b === "number" ? b : Number(b);
      if (
        !Number.isNaN(numA) &&
        !Number.isNaN(numB) &&
        String(a).trim() !== "" &&
        String(b).trim() !== ""
      ) {
        return (numA - numB) * direction;
      }
      return (
        String(a).localeCompare(String(b), undefined, { numeric: true }) *
        direction
      );
    });
  }, [result, searchTerm, sortColumn, sortDir]);

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

  const handleSort = (column: string): void => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortColumn(null);
      setSortDir(null);
    }
    if (containerRef.current) containerRef.current.scrollTop = 0;
    setScrollTop(0);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2.5 text-[13px] text-muted">
        <Loader2 className="size-4 animate-spin text-primary" />
        Executing query…
      </div>
    );
  }

  if (error !== undefined) {
    return (
      <div className="h-full overflow-auto p-4">
        <Alert variant="destructive" className="border-error/30 bg-error/8">
          <AlertDescription className="font-mono text-[12px] leading-relaxed">
            {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (result === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <span className="flex size-10 items-center justify-center border border-border bg-surface-alt/60">
          <TableProperties className="size-4 text-muted-dim" />
        </span>
        <p className="text-[13px] font-medium text-muted">No results yet</p>
        <p className="max-w-xs text-[11px] leading-relaxed text-muted-dim">
          Run a statement and its rows appear here.
        </p>
      </div>
    );
  }

  if (result.rows.length === 0 && !result.isSelect) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
        <p className="text-[13px] font-medium text-success">
          {result.message ?? "Statement executed"}
        </p>
        <p className="text-[11px] text-muted-dim">
          {result.rowsAffected ?? 0} row
          {(result.rowsAffected ?? 0) === 1 ? "" : "s"} affected
          {executionTime ? ` · ${executionTime}` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-dim">
          Results
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="numeric border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[10px] text-foreground">
              {rows.length} {rows.length === 1 ? "row" : "rows"}
            </span>
          </TooltipTrigger>
          <TooltipContent>Total matching rows returned</TooltipContent>
        </Tooltip>
        {executionTime !== null ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="numeric font-mono text-[10px] text-muted-dim">
                {executionTime}
              </span>
            </TooltipTrigger>
            <TooltipContent>Statement execution duration</TooltipContent>
          </Tooltip>
        ) : null}

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
            className="h-7 w-44 bg-surface-alt/40 pl-7 text-[11px]"
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
            <TooltipContent>Copy result rows as CSV</TooltipContent>
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
            <TooltipContent>Export result grid to .csv</TooltipContent>
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
            <TooltipContent>Export result grid to .json</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          setScrollTop(el.scrollTop);
          if (el.clientHeight !== viewportHeight) {
            setViewportHeight(el.clientHeight);
          }
        }}
        className="min-h-0 flex-1 overflow-auto"
      >
        <Table className="font-mono" style={{ fontSize }}>
          <TableHeader className="sticky top-0 z-10 bg-surface">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-12 text-[10px] font-medium text-muted-dim">
                #
              </TableHead>
              {columns.map((column) => (
                <TableHead key={column} className="whitespace-nowrap p-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleSort(column)}
                        className="flex h-8 w-full items-center gap-1 px-2 text-left font-medium text-muted transition-colors hover:text-foreground"
                        style={{ fontSize: Math.max(9, fontSize - 1) }}
                      >
                        {column}
                        {sortColumn === column ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="size-2.5 text-primary" />
                          ) : (
                            <ArrowDown className="size-2.5 text-primary" />
                          )
                        ) : null}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Sort by {column}</TooltipContent>
                  </Tooltip>
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
                  className="border-border/60"
                  style={
                    useVirtual ? { height: VIRTUAL_ROW_HEIGHT } : undefined
                  }
                >
                  <TableCell className="numeric text-[10px] text-muted-dim">
                    {rowNumber}
                  </TableCell>
                  {columns.map((column) => {
                    const value = row[column];
                    const isNull = value === null || value === undefined;
                    const display = isNull ? "null" : String(value);
                    return (
                      <TableCell
                        key={column}
                        className="max-w-[280px] truncate py-1.5"
                      >
                        {display.length > 36 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={isNull ? "italic text-muted-dim" : ""}>
                                {display}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md break-all font-mono text-[11px]">
                              {display}
                            </TooltipContent>
                          </Tooltip>
                        ) : isNull ? (
                          <span className="italic text-muted-dim">null</span>
                        ) : (
                          display
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

      <div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-surface px-3 font-mono text-[10px] text-muted-dim">
        <span className="numeric">
          {rows.length} {rows.length === 1 ? "row" : "rows"} · {columns.length}{" "}
          {columns.length === 1 ? "column" : "columns"}
          {useVirtual ? ` · showing rows ${startIndex + 1}-${endIndex}` : ""}
        </span>
        {executionTime ? <span>{executionTime}</span> : null}
      </div>
    </div>
  );
}
