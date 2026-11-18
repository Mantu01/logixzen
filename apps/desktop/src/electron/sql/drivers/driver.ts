import type { SqlResult, TableInfo } from "../../../shared/desktop-api";
import type { EngineDialect } from "../../../shared/engines";

export interface DatabaseDriver {
  readonly dialect: EngineDialect;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  execute(sql: string): Promise<SqlResult[]>;
  getSchema(): Promise<TableInfo[]>;
  getServerVersion(): Promise<string>;
  healthCheck(): Promise<boolean>;
  listDatabases(): Promise<string[]>;
  useDatabase(name: string): Promise<void>;
  currentDatabase(): string;
  resetDatabase(setupSql: string): Promise<void>;
}

export function translateDriverError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("no such column") ||
    lower.includes("invalid column name") ||
    lower.includes("unknown column") ||
    (lower.includes("column") &&
      (lower.includes("does not exist") || lower.includes("not found")))
  ) {
    return "Column not found. Check the spelling or explore the schema.";
  }
  if (
    lower.includes("no such table") ||
    lower.includes("invalid object name") ||
    lower.includes("doesn't exist") ||
    (lower.includes("table") && lower.includes("does not exist")) ||
    (lower.includes("relation") && lower.includes("does not exist")) ||
    lower.includes("does not exist")
  ) {
    return "Table not found. Check the spelling or explore the schema.";
  }
  if (
    lower.includes("ambiguous column") ||
    lower.includes("column reference is ambiguous")
  ) {
    return "Multiple tables have this column. Use table.column syntax.";
  }
  if (
    lower.includes("constraint") ||
    lower.includes("duplicate key") ||
    lower.includes("unique violation")
  ) {
    return "Data violates a rule (duplicate key or constraint).";
  }
  if (lower.includes("syntax error") || lower.includes("incorrect syntax")) {
    return message;
  }
  return message;
}
