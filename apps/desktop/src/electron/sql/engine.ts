import { DatabaseSync } from "node:sqlite";
import type { SqlRow, SqlResult, TableInfo } from "../../shared/desktop-api";
import {
  parseUseStatement,
  splitBatches,
  splitSqlStatements,
  unquoteIdentifier,
} from "../../shared/sql";

const MAX_ROWS = 1000;

const FORBIDDEN = [
  { regex: /\bATTACH\s+/i, message: "ATTACH DATABASE is not allowed." },
  { regex: /\bDETACH\s+/i, message: "DETACH DATABASE is not allowed." },
  { regex: /\bLOAD_EXTENSION\b/i, message: "LOAD_EXTENSION is not allowed." },
  { regex: /\bIMPORT\s+/i, message: "IMPORT is not allowed." },
  { regex: /\bCREATE\s+VIRTUAL\s+TABLE/i, message: "Virtual tables are not allowed." },
];

export function checkSafety(sql: string): string | null {
  for (const rule of FORBIDDEN) {
    if (rule.regex.test(sql)) {
      return rule.message;
    }
  }
  return null;
}

export function translateError(message: string): string {  const lower = message.toLowerCase();
  if (lower.includes("no such table")) {
    return "Table not found. Check the spelling or explore the schema.";
  }
  if (lower.includes("no such column")) {
    return "Column not found. Check the spelling or explore the schema.";
  }
  if (lower.includes("ambiguous column name")) {
    return "Multiple tables have this column. Use table.column syntax.";
  }
  if (lower.includes("constraint failed")) {
    return "Data violates a rule (duplicate key or constraint).";
  }
  if (lower.includes("syntax error")) {
    return message;
  }
  return message;
}

function isSelect(sql: string): boolean {
  const trimmed = sql.trim().toUpperCase();
  return (
    trimmed.startsWith("SELECT") ||
    trimmed.startsWith("WITH") ||
    trimmed.startsWith("VALUES") ||
    trimmed.startsWith("PRAGMA") ||
    trimmed.startsWith("EXPLAIN")
  );
}

const CREATE_DATABASE = /^CREATE\s+DATABASE\s+(IF\s+NOT\s+EXISTS\s+)?((?:\[[^\]]+\])|(?:"[^"]+")|(?:`[^`]+`)|(?:'[^']+')|[A-Za-z_][\w-]*)\s*;?\s*$/i;
const DROP_DATABASE = /^DROP\s+DATABASE\s+(IF\s+EXISTS\s+)?((?:\[[^\]]+\])|(?:"[^"]+")|(?:`[^`]+`)|(?:'[^']+')|[A-Za-z_][\w-]*)\s*;?\s*$/i;

interface DatabaseTarget {
  name: string;
  ifClause: boolean;
}

function parseDatabaseTarget(sql: string, regex: RegExp): DatabaseTarget | null {
  const match = regex.exec(sql.trim());
  if (match === null) return null;
  const name = unquoteIdentifier(match[2] ?? "");
  if (name.length === 0) return null;
  return { name, ifClause: (match[1] ?? "").trim().length > 0 };
}

export class DesktopSqlEngine {
  private databases = new Map<string, DatabaseSync>();
  private currentName: string | null = null;

  private get db(): DatabaseSync | null {
    if (this.currentName === null) return null;
    return this.databases.get(this.currentName) ?? null;
  }

  private load(name: string, setupSql?: string): void {
    const key = name.toLowerCase();
    const existing = this.databases.get(key);
    if (existing !== undefined) {
      existing.close();
      this.databases.delete(key);
    }
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    if (setupSql !== undefined && setupSql.trim().length > 0) {
      db.exec(setupSql);
    }
    this.databases.set(key, db);
  }

  initialize(setupSql?: string, name?: string): void {
    const key = (name ?? "main").toLowerCase();
    this.load(key, setupSql);
    this.currentName = key;
  }

  use(name: string): void {
    const key = name.toLowerCase();
    if (!this.databases.has(key)) {
      throw new Error(`Database "${name}" is not loaded. Create or import it in Databases first.`);
    }
    this.currentName = key;
  }

  list(): string[] {
    return Array.from(this.databases.keys());
  }

  private createDatabase(target: DatabaseTarget): string {
    const key = target.name.toLowerCase();
    if (this.databases.has(key)) {
      if (!target.ifClause) {
        throw new Error(`Database "${target.name}" already exists. Choose a different name.`);
      }
      this.currentName = key;
      return `Database "${target.name}" already exists.`;
    }
    this.load(target.name, undefined);
    this.currentName = key;
    return `Database "${target.name}" created.`;
  }

  private dropDatabase(target: DatabaseTarget): void {
    const key = target.name.toLowerCase();
    const existing = this.databases.get(key);
    if (existing === undefined) {
      if (target.ifClause) {
        if (this.currentName === key) this.currentName = null;
        return;
      }
      throw new Error(`Database "${target.name}" does not exist.`);
    }
    existing.close();
    this.databases.delete(key);
    if (this.currentName === key) this.currentName = null;
  }

  activeName(): string | null {
    return this.currentName;
  }

  execute(sql: string): SqlResult[] {
    const batches = splitBatches(sql);
    const results: SqlResult[] = [];
    let statementIndex = 0;
    const runStatement = (statementSql: string): void => {
      const started = performance.now();
      const index = statementIndex;
      statementIndex += 1;

      const firstLineEnd = statementSql.indexOf("\n");
      const firstLine = (firstLineEnd === -1 ? statementSql : statementSql.slice(0, firstLineEnd))
        .trim()
        .replace(/;+\s*$/, "");
      const useTarget = parseUseStatement(firstLine);

      if (useTarget !== null) {
        const remainder = firstLineEnd === -1 ? "" : statementSql.slice(firstLineEnd + 1).trim();
        try {
          this.use(useTarget);
        } catch (error: unknown) {
          results.push({
            ...this.emptyResult(index, started),
            error: error instanceof Error ? error.message : String(error),
          });
        }
        if (remainder.length > 0) runStatement(remainder);
        return;
      }

      const createTarget = parseDatabaseTarget(statementSql, CREATE_DATABASE);
      if (createTarget !== null) {
        try {
          results.push({
            ...this.emptyResult(index, started),
            message: this.createDatabase(createTarget),
          });
        } catch (error: unknown) {
          results.push({
            ...this.emptyResult(index, started),
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return;
      }

      const dropTarget = parseDatabaseTarget(statementSql, DROP_DATABASE);
      if (dropTarget !== null) {
        try {
          this.dropDatabase(dropTarget);
          results.push({
            ...this.emptyResult(index, started),
            message: `Database "${dropTarget.name}" removed.`,
          });
        } catch (error: unknown) {
          results.push({
            ...this.emptyResult(index, started),
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return;
      }

      if (this.db === null) {
        results.push({
          ...this.emptyResult(index, started),
          error: "No database is active. Select one with USE <name> or from the Databases page.",
        });
        return;
      }

      const safety = checkSafety(statementSql);
      if (safety !== null) {
        results.push({
          ...this.emptyResult(index, started),
          error: safety,
        });
        return;
      }

      try {
        if (isSelect(statementSql)) {
          const prepared = this.db.prepare(statementSql);
          const columns = prepared.columns().map((column) => column.name);
          const rows: SqlRow[] = [];
          for (const row of prepared.iterate()) {
            rows.push({ ...row });
            if (rows.length >= MAX_ROWS) {
              break;
            }
          }
          results.push({
            columns,
            rows,
            rowsAffected: 0,
            error: undefined,
            statementIndex: index,
            isSelect: true,
            executionTimeMs: performance.now() - started,
          });
        } else {
          this.db.exec(statementSql);
          const changes = this.db.prepare("SELECT changes() AS changes").get() as { changes?: number };
          results.push({
            columns: [],
            rows: [],
            rowsAffected: typeof changes?.changes === "number" ? changes.changes : 0,
            error: undefined,
            statementIndex: index,
            isSelect: false,
            executionTimeMs: performance.now() - started,
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          ...this.emptyResult(index, started),
          error: translateError(message),
        });
      }
    };

    for (const batch of batches) {
      for (const statement of splitSqlStatements(batch.join("\n"))) {
        runStatement(statement.sql);
      }
    }

    return results;
  }

  getSchema(): TableInfo[] {
    const db = this.db;
    if (db === null) {
      return [];
    }

    const tableRows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string }>;

    return tableRows.map(({ name }) => {
      const columns = db
        .prepare(`PRAGMA table_info("${name.replace(/"/g, '""')}")`)
        .all()
        .map((column) => ({
          cid: Number(column.cid),
          name: String(column.name),
          type: String(column.type),
          notNull: Number(column.notnull) === 1,
          defaultValue: column.dflt_value,
          primaryKey: Number(column.pk) !== 0,
        }));

      const sampleRows = db
        .prepare(`SELECT * FROM "${name.replace(/"/g, '""')}" LIMIT 5`)
        .all()
        .map((row) => ({ ...row })) as SqlRow[];

      const foreignKeys = db
        .prepare(`PRAGMA foreign_key_list("${name.replace(/"/g, '""')}")`)
        .all()
        .map((key) => ({
          from: String(key.from),
          table: String(key.table),
          to: String(key.to),
        }));

      const primaryKey = columns.filter((column) => column.primaryKey).map((column) => column.name);

      return {
        name,
        columns,
        sampleRows,
        primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
        foreignKeys,
      };
    });
  }

  isolatedRun(setupSql: string, sql: string): SqlResult[] {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("PRAGMA foreign_keys = ON;");
      if (setupSql.trim().length > 0) {
        db.exec(setupSql);
      }
      const engine = new DesktopSqlEngine();
      engine.databases.set("isolated", db);
      engine.currentName = "isolated";
      try {
        return engine.execute(sql);
      } finally {
        engine.databases.delete("isolated");
        engine.currentName = null;
      }
    } finally {
      db.close();
    }
  }

  private emptyResult(statementIndex: number, started: number): SqlResult {
    return {
      columns: [],
      rows: [],
      rowsAffected: 0,
      error: undefined,
      statementIndex,
      isSelect: false,
      executionTimeMs: performance.now() - started,
    };
  }
}
