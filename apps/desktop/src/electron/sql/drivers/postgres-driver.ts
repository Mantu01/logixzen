import { Client } from "pg";
import type { SqlResult, SqlRow, TableInfo } from "../../../shared/desktop-api";
import {
  parseCreateDatabase,
  parseUseStatement,
  splitSqlStatements,
} from "../../../shared/sql";
import type { DatabaseDriver } from "./driver";
import { translateDriverError } from "./driver";

export interface PostgresConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

export class PostgresDriver implements DatabaseDriver {
  readonly dialect = "postgres" as const;
  private client: Client | null = null;
  private config: PostgresConfig;

  constructor(config: PostgresConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.client) return;
    const client = new Client({
      host: this.config.host ?? "127.0.0.1",
      port: this.config.port ?? 5432,
      database: this.config.database ?? "LogixZenPractice",
      user: this.config.user ?? "logixzen",
      password: this.config.password ?? "",
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    this.client = client;
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.end();
    } catch {
    } finally {
      this.client = null;
    }
  }

  async execute(sql: string): Promise<SqlResult[]> {
    if (!this.client) {
      await this.connect();
    }
    const client = this.client!;
    const statements = splitSqlStatements(sql);
    const results: SqlResult[] = [];

    for (let index = 0; index < statements.length; index += 1) {
      const stmt = statements[index];
      const started = performance.now();
      try {
        const res = await client.query(stmt.sql);
        const isSelect =
          res.command === "SELECT" ||
          res.command === "SHOW" ||
          res.command === "EXPLAIN" ||
          stmt.sql.trim().toUpperCase().startsWith("WITH");

        results.push({
          columns: res.fields ? res.fields.map((f) => f.name) : [],
          rows: (res.rows || []).slice(0, 1000) as SqlRow[],
          rowsAffected: typeof res.rowCount === "number" ? res.rowCount : 0,
          statementIndex: index,
          isSelect,
          executionTimeMs: performance.now() - started,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          columns: [],
          rows: [],
          rowsAffected: 0,
          error: translateDriverError(msg),
          statementIndex: index,
          isSelect: false,
          executionTimeMs: performance.now() - started,
        });
      }
    }

    return results;
  }

  async getSchema(): Promise<TableInfo[]> {
    if (!this.client) {
      await this.connect();
    }
    const client = this.client!;

    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables: TableInfo[] = [];

    for (const row of tablesRes.rows) {
      const tableName = String(row.table_name);

      const colRes = await client.query(
        `
        SELECT column_name, data_type, is_nullable, column_default, ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `,
        [tableName],
      );

      const pkRes = await client.query(
        `
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1;
      `,
        [tableName],
      );

      const fkRes = await client.query(
        `
        SELECT
          kcu.column_name AS from_column,
          ccu.table_name AS to_table,
          ccu.column_name AS to_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name = $1;
      `,
        [tableName],
      );

      let sampleRows: SqlRow[] = [];
      try {
        const sampleRes = await client.query(
          `SELECT * FROM "${tableName.replace(/"/g, '""')}" LIMIT 5;`,
        );
        sampleRows = sampleRes.rows as SqlRow[];
      } catch {
        sampleRows = [];
      }

      const primaryKeys = pkRes.rows.map((r) => String(r.column_name));
      const foreignKeys = fkRes.rows.map((r) => ({
        from: String(r.from_column),
        table: String(r.to_table),
        to: String(r.to_column),
      }));

      tables.push({
        name: tableName,
        columns: colRes.rows.map((c) => ({
          cid: Number(c.ordinal_position),
          name: String(c.column_name),
          type: String(c.data_type),
          notNull: c.is_nullable === "NO",
          defaultValue:
            c.column_default !== null ? String(c.column_default) : null,
          primaryKey: primaryKeys.includes(String(c.column_name)),
        })),
        sampleRows,
        primaryKey: primaryKeys.length > 0 ? primaryKeys : undefined,
        foreignKeys,
      });
    }

    return tables;
  }

  async getServerVersion(): Promise<string> {
    if (!this.client) await this.connect();
    const res = await this.client!.query("SELECT version();");
    return String(res.rows[0]?.version ?? "PostgreSQL");
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) await this.connect();
      const res = await this.client!.query("SELECT 1 AS ok;");
      return res.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  async listDatabases(): Promise<string[]> {
    if (!this.client) await this.connect();
    const res = await this.client!.query(
      "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;",
    );
    return res.rows
      .map((row) => String(row.datname))
      .filter((name) => name !== "postgres");
  }

  async useDatabase(name: string): Promise<void> {
    if (name === this.config.database) return;
    const known = await this.listDatabases();
    const target = known.find(
      (entry) => entry.toLowerCase() === name.toLowerCase(),
    );
    if (target === undefined) {
      throw new Error(
        `Database "${name}" does not exist on this PostgreSQL server.`,
      );
    }
    await this.disconnect();
    this.config = { ...this.config, database: target };
    await this.connect();
  }

  currentDatabase(): string {
    return this.config.database ?? "LogixZenPractice";
  }

  async resetDatabase(setupSql: string): Promise<void> {
    if (!this.client) await this.connect();
    const client = this.client!;
    await client.query("DROP SCHEMA public CASCADE;");
    await client.query("CREATE SCHEMA public;");
    const statements = splitSqlStatements(setupSql).filter(
      (statement) =>
        parseCreateDatabase(statement.sql) === null &&
        parseUseStatement(statement.sql) === null,
    );
    await client.query("BEGIN;");
    try {
      for (const statement of statements) {
        await client.query(statement.sql);
      }
      await client.query("COMMIT;");
    } catch (error: unknown) {
      await client.query("ROLLBACK;").catch(() => undefined);
      throw error;
    }
  }
}
