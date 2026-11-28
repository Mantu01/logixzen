import { DatabaseSync } from "node:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import {
  parseCreateDatabase,
  parseDropDatabase,
  parseUseStatement,
  stripLeadingComments,
} from "../../../shared/sql";
import type {
  SqlResult,
  TableInfo,
} from "../../../shared/desktop-api";
import type { EngineDialect } from "../../../shared/engines";
import { sqlitePracticeFile } from "../../paths";
import { splitScript } from "../script-splitter";
import { formatSqlRow } from "../value-formatter";
import { emptyResult, type EngineDriver, type SqlOptions } from "./base";

const PRACTICE_DATABASE = "practice";
const DEFAULT_MAX_ROWS = 10000;

const FORBIDDEN = [
  { regex: /\bATTACH\s+/i, message: "ATTACH DATABASE is not allowed." },
  { regex: /\bDETACH\s+/i, message: "DETACH DATABASE is not allowed." },
  { regex: /\bLOAD_EXTENSION\b/i, message: "LOAD_EXTENSION is not allowed." },
  {
    regex: /\bCREATE\s+VIRTUAL\s+TABLE/i,
    message: "Virtual tables are not allowed.",
  },
];

function safetyError(sql: string): string | null {
  for (const rule of FORBIDDEN) {
    if (rule.regex.test(sql)) return rule.message;
  }
  return null;
}

function returnsRows(sql: string): boolean {
  const trimmed = stripLeadingComments(sql).trim().toUpperCase();
  return (
    trimmed.startsWith("SELECT") ||
    trimmed.startsWith("WITH") ||
    trimmed.startsWith("VALUES") ||
    trimmed.startsWith("PRAGMA") ||
    trimmed.startsWith("EXPLAIN") ||
    /^(?:INSERT|UPDATE|DELETE)\b[\s\S]*\bRETURNING\b/.test(trimmed)
  );
}

class SqliteEngine {
  private databases = new Map<string, DatabaseSync>();
  private currentName: string | null = null;

  private get active(): DatabaseSync | null {
    if (this.currentName === null) return null;
    return this.databases.get(this.currentName) ?? null;
  }

  public open(filePath: string, name = PRACTICE_DATABASE): void {
    mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
    this.close(name);
    const database = new DatabaseSync(filePath);
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec("PRAGMA busy_timeout = 5000;");
    database.exec("PRAGMA synchronous = NORMAL;");
    this.databases.set(name, database);
    this.currentName = name;
  }

  public close(name = PRACTICE_DATABASE): void {
    const database = this.databases.get(name);
    if (database === undefined) return;
    try {
      database.close();
    } catch {}
    this.databases.delete(name);
    if (this.currentName === name) {
      this.currentName = null;
    }
  }

  public has(name: string): boolean {
    return this.databases.has(name.toLowerCase());
  }

  public initialize(
    setupSql: string | undefined,
    name: string,
    reset: boolean,
    filePath?: string,
  ): void {
    const key = name.toLowerCase();
    if (this.databases.has(key) && !reset) {
      this.currentName = key;
      return;
    }
    this.close(key);
    if (filePath !== undefined && key === PRACTICE_DATABASE) {
      if (reset) {
        try {
          rmSync(filePath, { force: true });
          rmSync(`${filePath}-wal`, { force: true });
          rmSync(`${filePath}-shm`, { force: true });
        } catch {}
      }
      this.open(filePath, key);
      const practiceDb = this.databases.get(key);
      if (
        practiceDb !== undefined &&
        setupSql !== undefined &&
        setupSql.trim().length > 0
      ) {
        practiceDb.exec(setupSql);
      }
      return;
    }
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON;");
    if (setupSql !== undefined && setupSql.trim().length > 0) {
      database.exec(setupSql);
    }
    this.databases.set(key, database);
    this.currentName = key;
  }

  public list(): string[] {
    return [...this.databases.keys()];
  }

  public use(name: string): void {
    const key = name.toLowerCase();
    if (!this.databases.has(key)) {
      throw new Error(`Database "${name}" is not open in this session.`);
    }
    this.currentName = key;
  }

  public current(): string {
    return this.currentName ?? PRACTICE_DATABASE;
  }

  private create(name: string, ifMissing: boolean): string {
    const key = name.toLowerCase();
    if (this.databases.has(key)) {
      if (!ifMissing) {
        throw new Error(`Database "${name}" already exists.`);
      }
      this.currentName = key;
      return `Database "${name}" already exists.`;
    }
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON;");
    this.databases.set(key, database);
    this.currentName = key;
    return `Database "${name}" created.`;
  }

  private drop(name: string, ifMissing: boolean): string {
    const key = name.toLowerCase();
    if (key === PRACTICE_DATABASE) {
      throw new Error(
        "The practice database cannot be dropped. Use Reset in Databases.",
      );
    }
    const database = this.databases.get(key);
    if (database === undefined) {
      if (!ifMissing) {
        throw new Error(`Database "${name}" does not exist.`);
      }
      return `Database "${name}" not present.`;
    }
    try {
      database.close();
    } catch {}
    this.databases.delete(key);
    if (this.currentName === key) {
      this.currentName = null;
    }
    return `Database "${name}" removed.`;
  }

  public execute(sql: string, maxRows = DEFAULT_MAX_ROWS): SqlResult[] {
    const split = splitScript(sql, "sqlite");
    if (split.error !== undefined) {
      return [emptyResult(0, performance.now(), split.error)];
    }
    const results: SqlResult[] = [];
    let statementIndex = 0;

    const run = (statement: string): void => {
      const started = performance.now();
      const index = statementIndex;
      statementIndex += 1;

      const stripped = stripLeadingComments(statement);
      const firstLineEnd = stripped.indexOf("\n");
      const firstLine = (
        firstLineEnd === -1 ? stripped : stripped.slice(0, firstLineEnd)
      )
        .trim()
        .replace(/;+\s*$/, "");

      const useTarget = parseUseStatement(firstLine);
      if (useTarget !== null) {
        try {
          this.use(useTarget);
        } catch (error) {
          results.push(
            emptyResult(index, started, (error as Error).message),
          );
        }
        const remainder =
          firstLineEnd === -1 ? "" : stripped.slice(firstLineEnd + 1).trim();
        if (remainder.length > 0) run(remainder);
        return;
      }

      const created = parseCreateDatabase(statement);
      if (created !== null) {
        try {
          results.push(
            emptyResult(
              index,
              started,
              undefined,
              this.create(created.name, created.ifClause),
            ),
          );
        } catch (error) {
          results.push(
            emptyResult(index, started, (error as Error).message),
          );
        }
        return;
      }

      const dropped = parseDropDatabase(statement);
      if (dropped !== null) {
        try {
          results.push(
            emptyResult(
              index,
              started,
              undefined,
              this.drop(dropped.name, dropped.ifClause),
            ),
          );
        } catch (error) {
          results.push(
            emptyResult(index, started, (error as Error).message),
          );
        }
        return;
      }

      const database = this.active;
      if (database === null) {
        results.push(
          emptyResult(
            index,
            started,
            "No database is open. Select a dataset or run USE <name>.",
          ),
        );
        return;
      }

      const blocked = safetyError(statement);
      if (blocked !== null) {
        results.push(emptyResult(index, started, blocked));
        return;
      }

      try {
        if (returnsRows(statement)) {
          const prepared = database.prepare(statement);
          const columns = prepared.columns().map((column) => column.name);
          const rows: Record<string, unknown>[] = [];
          for (const row of prepared.iterate()) {
            rows.push(formatSqlRow(row as Record<string, unknown>));
            if (rows.length >= maxRows) break;
          }
          results.push({
            columns,
            rows,
            rowsAffected: 0,
            statementIndex: index,
            isSelect: true,
            executionTimeMs: Math.round(performance.now() - started),
          });
          return;
        }

        database.exec(statement);
        const changes = database
          .prepare("SELECT changes() AS changes")
          .get() as { changes?: number };
        results.push({
          columns: [],
          rows: [],
          rowsAffected:
            typeof changes?.changes === "number" ? changes.changes : 0,
          statementIndex: index,
          isSelect: false,
          executionTimeMs: Math.round(performance.now() - started),
        });
      } catch (error) {
        results.push(
          emptyResult(index, started, (error as Error).message),
        );
      }
    };

    for (const statement of split.statements) {
      run(statement);
    }

    return results;
  }

  public getSchema(): TableInfo[] {
    const database = this.active;
    if (database === null) return [];

    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>;

    return tables.map(({ name }) => {
      const quoted = `"${name.replace(/"/g, '""')}"`;
      const columns = database
        .prepare(`PRAGMA table_info(${quoted})`)
        .all()
        .map((column) => ({
          cid: Number(column.cid),
          name: String(column.name),
          type: String(column.type),
          notNull: Number(column.notnull) === 1,
          defaultValue: column.dflt_value,
          primaryKey: Number(column.pk) !== 0,
        }));

      const sampleRows = database
        .prepare(`SELECT * FROM ${quoted} LIMIT 5`)
        .all()
        .map((row) => formatSqlRow(row as Record<string, unknown>));

      const foreignKeys = database
        .prepare(`PRAGMA foreign_key_list(${quoted})`)
        .all()
        .map((key) => ({
          from: String(key.from),
          table: String(key.table),
          to: String(key.to),
        }));

      const primaryKey = columns
        .filter((column) => column.primaryKey)
        .map((column) => column.name);

      return {
        name,
        columns,
        sampleRows,
        primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
        foreignKeys,
      };
    });
  }
}

export const sqliteEngine = new SqliteEngine();

export function isolatedSqliteRun(setupSql: string, sql: string): SqlResult[] {
  const engine = new SqliteEngine();
  engine.open(":memory:", "isolated");
  try {
    if (setupSql.trim().length > 0) {
      engine.execute(setupSql, Number.MAX_SAFE_INTEGER);
    }
    return engine.execute(sql, Number.MAX_SAFE_INTEGER);
  } finally {
    engine.close("isolated");
  }
}

export class SqliteDriver implements EngineDriver {
  readonly dialect: EngineDialect = "sqlite";

  constructor(private readonly filePath = sqlitePracticeFile()) {}

  public async connect(): Promise<void> {
    sqliteEngine.open(this.filePath);
  }

  public async disconnect(): Promise<void> {
    sqliteEngine.close();
  }

  public async execute(
    sql: string,
    options?: SqlOptions,
  ): Promise<SqlResult[]> {
    this.ensureOpen();
    return sqliteEngine.execute(sql, options?.maxRows ?? DEFAULT_MAX_ROWS);
  }

  public async initializeDatabase(
    setupSql?: string,
    name?: string,
    reset = false,
  ): Promise<void> {
    if (name === undefined || name.trim().length === 0) {
      this.ensureOpen();
      return;
    }
    sqliteEngine.initialize(setupSql, name, reset, this.filePath);
  }

  public async cancel(): Promise<void> {
    return Promise.resolve();
  }

  public async getSchema(): Promise<TableInfo[]> {
    this.ensureOpen();
    return sqliteEngine.getSchema();
  }

  public async listDatabases(): Promise<string[]> {
    return sqliteEngine.list();
  }

  public async useDatabase(name: string): Promise<void> {
    sqliteEngine.use(name);
  }

  public currentDatabase(): string {
    return sqliteEngine.current();
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const results = await this.execute("SELECT 1 AS ok;", { maxRows: 1 });
      return results[0]?.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  public async getServerVersion(): Promise<string> {
    const results = await this.execute("SELECT sqlite_version() AS version;", {
      maxRows: 1,
    });
    const version = results[0]?.rows[0]?.version;
    return typeof version === "string" ? `SQLite ${version}` : "SQLite";
  }

  private ensureOpen(): void {
    if (!sqliteEngine.has(PRACTICE_DATABASE)) {
      sqliteEngine.open(this.filePath);
    }
  }
}
