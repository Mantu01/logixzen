"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search, Table2 } from "lucide-react";
import type { TableInfo } from "@logixzen/shared/sql-engine";
import { cn } from "@/lib/utils";

interface SchemaPanelProps {
  tables: TableInfo[];
  activeTable: string | null;
  onSelectTable: (table: string) => void;
}

export function SchemaPanel({ tables, activeTable, onSelectTable }: SchemaPanelProps): React.ReactElement {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term === "") return tables;
    return tables.filter(
      (table) =>
        table.name.toLowerCase().includes(term) ||
        table.columns.some((column) => column.name.toLowerCase().includes(term)),
    );
  }, [tables, search]);

  const toggle = (name: string): void => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
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
          const open = expanded.has(table.name) || activeTable === table.name;
          return (
            <div key={table.name}>
              <button
                type="button"
                onClick={() => {
                  toggle(table.name);
                  onSelectTable(table.name);
                }}
                className={cn(
                  "group flex h-7 w-full items-center gap-1 px-1.5 text-left text-[12px] transition-colors hover:bg-surface-hover",
                  activeTable === table.name && "bg-accent text-accent-foreground",
                )}
              >
                <ChevronRight
                  className={cn("size-3 shrink-0 text-muted-dim transition-transform", open && "rotate-90")}
                />
                <Table2 className={cn("size-3 shrink-0", activeTable === table.name ? "text-primary" : "text-muted-dim")} />
                <span className="min-w-0 flex-1 truncate font-mono">{table.name}</span>
                <span className="numeric shrink-0 text-[9.5px] text-muted-dim">{table.columns.length}</span>
              </button>
              {open ? (
                <div className="pb-1">
                  {table.columns.map((column) => {
                    const fk = table.foreignKeys.find((relation) => relation.from === column.name);
                    return (
                      <div
                        key={column.name}
                        className="flex h-6 items-center gap-2 pl-8 pr-2 text-[11px] text-muted"
                      >
                        <span
                          className={cn(
                            "size-1 shrink-0",
                            column.primaryKey ? "bg-warning" : fk ? "bg-primary" : "bg-border",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate font-mono text-foreground/85">{column.name}</span>
                        <span className="shrink-0 font-mono text-[9px] uppercase text-muted-dim">{column.type}</span>
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
