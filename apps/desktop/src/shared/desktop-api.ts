export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface OpenFileOptions {
  title?: string;
  filters?: FileFilter[];
}

export interface SaveFileOptions extends OpenFileOptions {
  defaultPath?: string;
}

export interface SqlRow {
  [key: string]: unknown;
}

export interface SqlResult {
  columns: string[];
  rows: SqlRow[];
  rowsAffected: number;
  error?: string;
  message?: string;
  statementIndex: number;
  isSelect: boolean;
  executionTimeMs: number;
}

export interface ForeignKeyInfo {
  from: string;
  table: string;
  to: string;
}

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: unknown;
  primaryKey: boolean;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  sampleRows: SqlRow[];
  primaryKey?: string[];
  foreignKeys: ForeignKeyInfo[];
}

export type AiProvider = "openai" | "anthropic" | "openrouter" | "custom";

export interface AiCompletionRequest {
  provider: AiProvider;
  model: string;
  baseUrl: string | null;
  prompt: string;
  maxTokens?: number;
}

export interface DesktopApi {
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  storage: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  secrets: {
    store: (key: string, value: string) => Promise<void>;
    retrieve: (key: string) => Promise<string | null>;
    delete: (key: string) => Promise<void>;
  };
  dialog: {
    openFile: (options?: OpenFileOptions) => Promise<string | null>;
    saveFile: (options?: SaveFileOptions) => Promise<string | null>;
  };
  database: {
    initialize: (setupSql?: string, name?: string) => Promise<void>;
    execute: (sql: string) => Promise<SqlResult[]>;
    use: (name: string) => Promise<void>;
    list: () => Promise<string[]>;
    active: () => Promise<string | null>;
    getSchema: () => Promise<TableInfo[]>;
    isolatedRun: (setupSql: string, sql: string) => Promise<SqlResult[]>;
  };
  files: {
    readText: (filePath: string) => Promise<string>;
    writeText: (filePath: string, content: string) => Promise<void>;
  };
  ai: {
    complete: (request: AiCompletionRequest) => Promise<string>;
  };
  notifications: {
    badge: (title: string, body: string) => Promise<void>;
    streak: (streak: number) => Promise<void>;
  };
  menu: {
    onNavigate: (callback: (path: string) => void) => () => void;
  };
}
