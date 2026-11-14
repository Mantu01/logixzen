"use client";

import { useSqlStore } from "@/sql/useSqlStore";
import { usePackStore } from "@/stores/usePackStore";

export function StatusBar(): React.ReactElement {
  const schema = useSqlStore((state) => state.schema);
  const activeDatasetId = useSqlStore((state) => state.activeDatasetId);
  const isInitialized = useSqlStore((state) => state.isInitialized);
  const databases = usePackStore((state) => state.databases);
  const activeName = databases.find((item) => item.id === activeDatasetId)?.name;
  const tables = schema.length;

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between gap-4 border-t border-border bg-titlebar px-3 text-[10.5px] text-muted-dim">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span
            className={`size-1.5 ${isInitialized ? "bg-success" : "bg-muted-dim"}`}
            aria-hidden="true"
          />
          {activeName ?? "no database"}
        </span>
        <span className="numeric">{tables} tables</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="numeric">LogixZen v0.1.0</span>
      </div>
    </footer>
  );
}
