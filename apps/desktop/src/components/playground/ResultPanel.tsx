import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  FileJson,
  Loader2,
  Search,
  TableProperties,
} from "lucide-react";
import { useMemo, useState } from "react";
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

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
      return (
        String(a).localeCompare(String(b), undefined, { numeric: true }) *
        direction
      );
    });
  }, [result, searchTerm, sortColumn, sortDir]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const visibleRows = rows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
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
    setCurrentPage(1);
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

  if (
    result === null ||
    (result.rows.length === 0 && result.columns.length === 0)
  ) {
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

  if (result.rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
        <p className="text-[13px] font-medium text-success">
          {result.message ?? "Statement executed"}
        </p>
        {result.message === undefined ? (
          <p className="text-[11px] text-muted-dim">
            {result.rowsAffected ?? 0} row
            {(result.rowsAffected ?? 0) === 1 ? "" : "s"} affected
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-dim">
          Results
        </span>
        <span className="numeric bg-surface-alt px-1.5 py-0.5 text-[10px] text-muted">
          {rows.length}
        </span>
        {executionTime !== null ? (
          <span className="numeric text-[10px] text-muted-dim">
            {executionTime}
          </span>
        ) : null}

        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-dim" />
          <Input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Filter rows"
            aria-label="Filter result rows"
            className="h-7 w-44 bg-surface-alt/40 pl-7 text-[11px]"
          />
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            onClick={() => onCopy(result)}
            variant="ghost"
            size="icon-xs"
            title="Copy results (CSV)"
            className="text-muted"
          >
            <ClipboardCopy />
          </Button>
          <Button
            onClick={() => onExportCsv(result)}
            variant="ghost"
            size="icon-xs"
            title="Export CSV"
            className="text-muted"
          >
            <Download />
          </Button>
          <Button
            onClick={() => onExportJson(result)}
            variant="ghost"
            size="icon-xs"
            title="Export JSON"
            className="text-muted"
          >
            <FileJson />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Table className="font-mono" style={{ fontSize }}>
          <TableHeader className="sticky top-0 z-10 bg-surface">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-12 text-[10px] font-medium text-muted-dim">
                #
              </TableHead>
              {columns.map((column) => (
                <TableHead key={column} className="whitespace-nowrap p-0">
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
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row, index) => (
              <TableRow key={index} className="border-border/60">
                <TableCell className="numeric text-[10px] text-muted-dim">
                  {(safePage - 1) * pageSize + index + 1}
                </TableCell>
                {columns.map((column) => (
                  <TableCell
                    key={column}
                    className="max-w-[280px] truncate py-1.5"
                    title={String(row[column] ?? "null")}
                  >
                    {row[column] === null || row[column] === undefined ? (
                      <span className="italic text-muted-dim">null</span>
                    ) : (
                      String(row[column])
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="py-8 text-center text-muted"
                >
                  No rows match the filter
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-surface px-3 text-[10px] text-muted-dim">
        <span className="numeric">
          Page {safePage} of {totalPages} · {rows.length} rows
        </span>
        <div className="flex items-center gap-1">
          <Button
            onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
            variant="ghost"
            size="icon-xs"
            disabled={safePage === 1}
            aria-label="Previous page"
            className="text-muted"
          >
            <ChevronLeft />
          </Button>
          <Button
            onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
            variant="ghost"
            size="icon-xs"
            disabled={safePage === totalPages}
            aria-label="Next page"
            className="text-muted"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
