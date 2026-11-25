import type { EngineDialect } from "../../../shared/engines";
import type {
  SqlResult,
  TableInfo,
} from "../../../shared/desktop-api";

export interface SqlOptions {
  maxRows?: number;
  timeoutMs?: number;
}

export interface EngineDriver {
  readonly dialect: EngineDialect;
  readonly port?: number;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  execute(sql: string, options?: SqlOptions): Promise<SqlResult[]>;
  isolatedRun?(setupSql: string, sql: string): Promise<SqlResult[]>;
  initializeDatabase?(
    setupSql?: string,
    name?: string,
    reset?: boolean,
  ): Promise<void>;
  cancel(): Promise<void>;
  getSchema(): Promise<TableInfo[]>;
  listDatabases(): Promise<string[]>;
  useDatabase(name: string): Promise<void>;
  currentDatabase(): string;
  healthCheck(): Promise<boolean>;
  getServerVersion(): Promise<string>;
}

export function emptyResult(
  statementIndex: number,
  started: number,
  error?: string,
  message?: string,
): SqlResult {
  return {
    columns: [],
    rows: [],
    rowsAffected: 0,
    error,
    message,
    statementIndex,
    isSelect: false,
    executionTimeMs: Math.round(performance.now() - started),
  };
}
