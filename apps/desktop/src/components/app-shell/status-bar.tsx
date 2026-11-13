"use client";

import { Kbd } from "@/components/ui/kbd";
import { useSqlStore } from "@/sql/useSqlStore";

export function StatusBar(): React.ReactElement {
  const schema = useSqlStore((state) => state.schema);
  const activeDatasetId = useSqlStore((state) => state.activeDatasetId);
  const isInitialized = useSqlStore((state) => state.isInitialized);
  const tables = schema.length;

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between gap-4 border-t border-border bg-titlebar px-3 text-[10.5px] text-muted-dim">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span
            className={`size-1.5 ${isInitialized ? "bg-success" : "bg-muted-dim"}`}
            aria-hidden="true"
          />
          {activeDatasetId ?? "no database"}
        </span>
        <span className="numeric">{tables} tables</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1 md:flex">
          <Kbd className="h-4 px-1 text-[9px]">Ctrl</Kbd>
          <span>+</span>
          <Kbd className="h-4 px-1 text-[9px]">Enter</Kbd>
          <span>run query</span>
        </span>
        <span className="numeric">LogixZen v0.1.0</span>
      </div>
    </footer>
  );
}
