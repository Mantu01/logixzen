import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { SqlRow, SqlResult, TableInfo } from "../../shared/desktop-api";

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

export function translateError(message: string): string {
  const lower = message.toLowerCase();
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

export class DesktopSqlEngine {
  private db: DatabaseSync | null = null;

  initialize(setupSql?: string): void {
    this.close();
    this.db = new DatabaseSync(":memory:");
    this.db.exec("PRAGMA foreign_keys = ON;");
    if (setupSql !== undefined && setupSql.trim().length > 0) {
      this.db.exec(setupSql);
    }
  }

  execute(sql: string): SqlResult[] {
    if (this.db === null) {
      throw new Error("Database not initialized");
    }

    const statements = splitSqlStatements(sql);
    const results: SqlResult[] = [];

    for (const statement of statements) {
      const started = performance.now();
      const safety = checkSafety(statement.sql);
      if (safety !== null) {
        results.push({
          columns: [],
          rows: [],
          rowsAffected: 0,
          error: safety,
          statementIndex: statement.index,
          isSelect: false,
          executionTimeMs: 0,
        });
        continue;
      }

      try {
        if (isSelect(statement.sql)) {
          const prepared = this.db.prepare(statement.sql);
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
            statementIndex: statement.index,
            isSelect: true,
            executionTimeMs: performance.now() - started,
          });
        } else {
          this.db.exec(statement.sql);
          const changes = this.db.prepare("SELECT changes() AS changes").get() as { changes?: number };
          results.push({
            columns: [],
            rows: [],
            rowsAffected: typeof changes?.changes === "number" ? changes.changes : 0,
            statementIndex: statement.index,
            isSelect: false,
            executionTimeMs: performance.now() - started,
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          columns: [],
          rows: [],
          rowsAffected: 0,
          error: translateError(message),
          statementIndex: statement.index,
          isSelect: false,
          executionTimeMs: performance.now() - started,
        });
      }
    }

    return results;
  }

  getSchema(): TableInfo[] {
    if (this.db === null) {
      throw new Error("Database not initialized");
    }

    const db = this.db;
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

  reset(setupSql?: string): void {
    this.initialize(setupSql);
  }

  loadSqlFile(filePath: string): void {
    this.initialize();
    this.execute(readFileSync(filePath, "utf8"));
  }

  loadSqliteFile(filePath: string): void {
    this.close();
    this.db = new DatabaseSync(filePath, { readOnly: true });
  }

  importCsv(filePath: string, tableName: string): number {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
      throw new Error("Invalid table name");
    }
    if (this.db === null) {
      this.initialize();
    }
    const db = this.db;
    if (db === null) {
      throw new Error("Database not initialized");
    }

    const lines = readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);
    const header = lines.shift();
    if (header === undefined) {
      throw new Error("CSV file is empty");
    }

    const columns = header.split(",").map((name, index) => {
      const clean = name.trim().replace(/"/g, "");
      return /^[A-Za-z_][A-Za-z0-9_]*$/.test(clean) ? clean : `column_${index + 1}`;
    });

    db.exec(
      `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns
        .map((column) => `"${column}" TEXT`)
        .join(", ")})`,
    );

    const insert = db.prepare(
      `INSERT INTO "${tableName}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${columns
        .map(() => "?")
        .join(", ")})`,
    );

    let inserted = 0;
    db.exec("BEGIN");
    try {
      for (const line of lines) {
        const values = line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
        insert.run(...values);
        inserted += 1;
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    return inserted;
  }

  close(): void {
    if (this.db !== null) {
      this.db.close();
      this.db = null;
    }
  }

  isolatedRun(setupSql: string, sql: string): SqlResult[] {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("PRAGMA foreign_keys = ON;");
      if (setupSql.trim().length > 0) {
        db.exec(setupSql);
      }
      const engine = new DesktopSqlEngine();
      engine.db = db;
      try {
        return engine.execute(sql);
      } finally {
        engine.db = null;
      }
    } finally {
      db.close();
    }
  }
}

interface Statement {
  sql: string;
  index: number;
}

export function splitSqlStatements(sql: string): Statement[] {
  const statements: Statement[] = [];
  let current = "";
  let single = false;
  let double = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i] ?? "";
    const next = sql[i + 1];

    if (lineComment) {
      current += char;
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }
    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += "/";
        i += 1;
        blockComment = false;
      }
      continue;
    }
    if (single) {
      current += char;
      if (char === "'" && next === "'") {
        current += "'";
        i += 1;
      } else if (char === "'") {
        single = false;
      }
      continue;
    }
    if (double) {
      current += char;
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        double = false;
      }
      continue;
    }

    if (char === "-" && next === "-") {
      lineComment = true;
      current += "--";
      i += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      current += "/*";
      i += 1;
      continue;
    }
    if (char === "'") {
      single = true;
      current += char;
      continue;
    }
    if (char === '"') {
      double = true;
      current += char;
      continue;
    }
    if (char === ";") {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push({ sql: trimmed, index: statements.length });
      }
      current = "";
      continue;
    }
    current += char;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push({ sql: trimmed, index: statements.length });
  }

  return statements;
}
