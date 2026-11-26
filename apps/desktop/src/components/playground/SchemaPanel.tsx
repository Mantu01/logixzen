"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  Database,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Table2,
} from "lucide-react";
import type { Dataset } from "@logixzen/shared/content";
import type { TableInfo } from "@/shared/desktop-api";
import type { EngineOptionId } from "@/shared/engines";
import { isDatasetForEngine } from "@/lib/dataset-from-sql";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SchemaPanelProps {
  tables: TableInfo[];
  activeTable: string | null;
  onSelectTable: (table: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  databases?: Dataset[];
  activeDatasetId?: string | null;
  activeOptionId?: EngineOptionId;
  onSelectDatabase?: (datasetId: string) => void;
}

export function SchemaPanel({
  tables,
  activeTable,
  onSelectTable,
  collapsed = false,
  onToggleCollapsed,
  databases,
  activeDatasetId,
  activeOptionId = "sqlite",
  onSelectDatabase,
}: SchemaPanelProps): React.ReactElement {
  const [search, setSearch] = useState("");
  const [expandedTable, setExpandedTable] = useState<string | null>(
    activeTable,
  );
  const [userToggled, setUserToggled] = useState(false);

  const tableNames = useMemo(
    () => new Set(tables.map((table) => table.name)),
    [tables],
  );

  const openTable = useMemo(() => {
    if (userToggled) {
      return expandedTable !== null && tableNames.has(expandedTable)
        ? expandedTable
        : null;
    }
    if (activeTable !== null && tableNames.has(activeTable)) {
      return activeTable;
    }
    return expandedTable !== null && tableNames.has(expandedTable)
      ? expandedTable
      : null;
  }, [userToggled, expandedTable, activeTable, tableNames]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term === "") return tables;
    return tables.filter(
      (table) =>
        table.name.toLowerCase().includes(term) ||
        table.columns.some((column) =>
          column.name.toLowerCase().includes(term),
        ),
    );
  }, [tables, search]);

  const toggle = (name: string): void => {
    setUserToggled(true);
    setExpandedTable((previous) => (previous === name ? null : name));
  };

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-2 bg-surface pt-2">
        {onToggleCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Open schema panel"
                onClick={onToggleCollapsed}
                className="flex size-7 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <PanelRightOpen className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              Expand Schema sidebar (Ctrl+B)
            </TooltipContent>
          </Tooltip>
        ) : null}
        <span className="rotate-90 font-mono text-[10px] uppercase tracking-widest text-muted-dim">
          Schema
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border pl-2.5 pr-1.5">
        <div className="flex items-center gap-1.5">
          <span className="section-label">Schema</span>
          <span className="numeric text-[9.5px] text-muted-dim">
            {tables.length}
          </span>
        </div>
        {onToggleCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Close schema panel"
                onClick={onToggleCollapsed}
                className="flex size-6 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <PanelRightClose className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              Collapse Schema sidebar (Ctrl+B)
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {databases && onSelectDatabase ? (
        <div className="border-b border-border bg-surface-alt/40 p-1.5">
          <div className="section-label px-1 pb-1">Databases</div>
          <div className="max-h-36 space-y-0.5 overflow-y-auto">
            {databases.length === 0 ? (
              <p className="px-1.5 py-2 text-[10.5px] text-muted-dim">
                No databases installed
              </p>
            ) : (
              databases.map((dataset) => {
                const compatible = isDatasetForEngine(dataset, activeOptionId);
                const selected = dataset.id === activeDatasetId;
                const button = (
                  <button
                    key={dataset.id}
                    type="button"
                    disabled={!compatible}
                    onClick={() => compatible && onSelectDatabase(dataset.id)}
                    className={cn(
                      "flex h-6 w-full items-center gap-1.5 border px-1.5 text-left text-[11px] transition-colors",
                      selected
                        ? "border-primary/50 bg-primary/10 font-medium text-foreground"
                        : compatible
                          ? "border-transparent text-muted hover:bg-surface-hover hover:text-foreground"
                          : "cursor-not-allowed border-transparent text-muted-dim opacity-45",
                    )}
                  >
                    <Database className="size-3 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate">
                      {dataset.name}
                    </span>
                    {dataset.engineId ? (
                      <span className="font-mono text-[9px] uppercase text-muted-dim">
                        {dataset.engineId}
                      </span>
                    ) : null}
                    {selected ? (
                      <span
                        className="size-1.5 shrink-0 bg-success"
                        aria-label="active database"
                      />
                    ) : null}
                  </button>
                );

                return compatible ? (
                  button
                ) : (
                  <Tooltip key={dataset.id}>
                    <TooltipTrigger asChild>
                      <span className="block">{button}</span>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      Created for {dataset.engineId}. Switch engine to open.
                    </TooltipContent>
                  </Tooltip>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-2">
        <Search className="size-3 shrink-0 text-muted-dim" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tables and columns"
          aria-label="Search schema"
          className="h-full flex-1 bg-transparent text-[11.5px] outline-none placeholder:text-muted-dim"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-muted-dim">
            {tables.length === 0 ? "No tables in this database" : "No matches"}
          </p>
        ) : null}
        {filtered.map((table) => {
          const open = openTable === table.name;
          const selected = activeTable === table.name;
          return (
            <div key={table.name}>
              <div
                className={cn(
                  "flex h-7 items-center text-[12px] transition-colors hover:bg-surface-hover",
                  selected && "bg-accent text-accent-foreground",
                )}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={
                        open ? `Collapse ${table.name}` : `Expand ${table.name}`
                      }
                      aria-expanded={open}
                      onClick={() => toggle(table.name)}
                      className="flex size-6 shrink-0 items-center justify-center"
                    >
                      <ChevronRight
                        className={cn(
                          "size-3 shrink-0 text-muted-dim transition-transform duration-150",
                          open && "rotate-90",
                        )}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {open ? `Collapse ${table.name}` : `Expand ${table.name}`}
                  </TooltipContent>
                </Tooltip>
                <button
                  type="button"
                  onClick={() => {
                    setUserToggled(true);
                    setExpandedTable(table.name);
                    onSelectTable(table.name);
                  }}
                  className="flex h-7 min-w-0 flex-1 items-center gap-1.5 pr-2 text-left"
                >
                  <Table2
                    className={cn(
                      "size-3 shrink-0",
                      selected ? "text-primary" : "text-muted-dim",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {table.name}
                  </span>
                  <span className="numeric shrink-0 text-[9.5px] text-muted-dim">
                    {table.columns.length}
                  </span>
                </button>
              </div>
              {open ? (
                <div className="animate-fade-in pb-1">
                  {table.columns.map((column) => {
                    const fk = table.foreignKeys.find(
                      (relation) => relation.from === column.name,
                    );
                    return (
                      <Tooltip key={column.name}>
                        <TooltipTrigger asChild>
                          <div className="flex h-6 items-center gap-2 pl-8 pr-2 text-[11px] text-muted hover:bg-surface-hover/50">
                            <span
                              className={cn(
                                "size-1 shrink-0",
                                column.primaryKey
                                  ? "bg-warning"
                                  : fk
                                    ? "bg-primary"
                                    : "bg-border",
                              )}
                            />
                            <span className="min-w-0 flex-1 truncate font-mono text-foreground/85">
                              {column.name}
                            </span>
                            <span className="shrink-0 font-mono text-[9px] uppercase text-muted-dim">
                              {column.type}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          {column.name} ({column.type})
                          {column.primaryKey ? " · Primary Key" : ""}
                          {fk ? ` → ${fk.table}.${fk.to}` : ""}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
