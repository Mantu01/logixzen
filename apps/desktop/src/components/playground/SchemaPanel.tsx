"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Table2,
} from "lucide-react";
import type { TableInfo } from "@/shared/desktop-api";
import { cn } from "@/lib/utils";

interface SchemaPanelProps {
  tables: TableInfo[];
  activeTable: string | null;
  onSelectTable: (table: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function SchemaPanel({
  tables,
  activeTable,
  onSelectTable,
  collapsed = false,
  onToggleCollapsed,
}: SchemaPanelProps): React.ReactElement {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tableNames = useMemo(
    () => new Set(tables.map((table) => table.name)),
    [tables],
  );

  const openTables = useMemo(() => {
    const valid = new Set([...expanded].filter((name) => tableNames.has(name)));
    if (activeTable !== null && tableNames.has(activeTable))
      valid.add(activeTable);
    return valid;
  }, [expanded, tableNames, activeTable]);

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
    const isOpen = openTables.has(name);
    setExpanded((previous) => {
      const next = new Set(previous);
      if (isOpen) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-2 bg-surface pt-2">
        {onToggleCollapsed ? (
          <button
            type="button"
            aria-label="Open schema panel"
            title="Open schema panel"
            onClick={onToggleCollapsed}
            className="flex size-7 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <PanelRightOpen className="size-3.5" />
          </button>
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
          <button
            type="button"
            aria-label="Close schema panel"
            title="Close schema panel"
            onClick={onToggleCollapsed}
            className="flex size-6 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <PanelRightClose className="size-3.5" />
          </button>
        ) : null}
      </div>

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
          const open = openTables.has(table.name);
          const selected = activeTable === table.name;
          return (
            <div key={table.name}>
              <div
                className={cn(
                  "flex h-7 items-center text-[12px] transition-colors hover:bg-surface-hover",
                  selected && "bg-accent text-accent-foreground",
                )}
              >
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
                      "size-3 shrink-0 text-muted-dim transition-transform",
                      open && "rotate-90",
                    )}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!open) toggle(table.name);
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
                <div className="pb-1">
                  {table.columns.map((column) => {
                    const fk = table.foreignKeys.find(
                      (relation) => relation.from === column.name,
                    );
                    return (
                      <div
                        key={column.name}
                        className="flex h-6 items-center gap-2 pl-8 pr-2 text-[11px] text-muted"
                      >
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
