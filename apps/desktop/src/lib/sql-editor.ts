import type { TableInfo } from "@/shared/desktop-api";
import type { EngineDialect } from "@/shared/engines";

export const DIALECTS: Array<{ id: EngineDialect; label: string }> = [
  { id: "mysql", label: "MySQL" },
  { id: "postgres", label: "PostgreSQL" },
  { id: "sqlite", label: "SQLite" },
  { id: "tsql", label: "T-SQL" },
];

export function dialectLabel(id: EngineDialect): string {
  return DIALECTS.find((entry) => entry.id === id)?.label ?? id;
}

export function tableMapFrom(tables: TableInfo[]): Record<string, string[]> {
  return Object.fromEntries(
    tables.map((table) => [table.name, table.columns.map((column) => column.name)]),
  );
}
