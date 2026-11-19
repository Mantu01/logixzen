import mysql from "mysql2/promise";
import type {
  Connection,
  FieldPacket,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type { SqlResult, SqlRow, TableInfo } from "../../../shared/desktop-api";
import {
  parseCreateDatabase,
  parseUseStatement,
  splitSqlStatements,
} from "../../../shared/sql";
import type { DatabaseDriver } from "./driver";
import { translateDriverError } from "./driver";

interface MysqlConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

export class MysqlDriver implements DatabaseDriver {
  readonly dialect = "mysql" as const;
  private connection: Connection | null = null;
  private config: MysqlConfig;

  constructor(config: MysqlConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connection) return;
    this.connection = await mysql.createConnection({
      host: this.config.host ?? "127.0.0.1",
      port: this.config.port ?? 3306,
      database: this.config.database ?? "LogixZenPractice",
      user: this.config.user ?? "logixzen",
      password: this.config.password ?? "",
      connectTimeout: 5000,
    });
  }

  async disconnect(): Promise<void> {
    if (!this.connection) return;
    try {
      await this.connection.end();
    } catch {
    } finally {
      this.connection = null;
    }
  }

  async execute(sql: string): Promise<SqlResult[]> {
    if (!this.connection) {
      await this.connect();
    }
    const conn = this.connection!;
    const statements = splitSqlStatements(sql);
    const results: SqlResult[] = [];

    for (let index = 0; index < statements.length; index += 1) {
      const stmt = statements[index];
      const started = performance.now();
      try {
        const [rawRows, fields] = await conn.query(stmt.sql);
        if (Array.isArray(rawRows)) {
          const rows = rawRows as RowDataPacket[];
          const fieldList = (fields ?? []) as FieldPacket[];
          results.push({
            columns: fieldList.map((f) => f.name),
            rows: rows.slice(0, 1000) as SqlRow[],
            rowsAffected: 0,
            statementIndex: index,
            isSelect: true,
            executionTimeMs: performance.now() - started,
          });
        } else {
          const header = rawRows as ResultSetHeader;
          results.push({
            columns: [],
            rows: [],
            rowsAffected: header.affectedRows ?? 0,
            statementIndex: index,
            isSelect: false,
            executionTimeMs: performance.now() - started,
          });
        }
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
    if (!this.connection) {
      await this.connect();
    }
    const conn = this.connection!;

    const [tableRows] = await conn.query<RowDataPacket[]>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables: TableInfo[] = [];

    for (const row of tableRows) {
      const tableName = String(row.table_name ?? row.TABLE_NAME);

      const [colRows] = await conn.query<RowDataPacket[]>(
        `
        SELECT column_name, data_type, is_nullable, column_default, ordinal_position
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ?
        ORDER BY ordinal_position;
      `,
        [tableName],
      );

      const [pkRows] = await conn.query<RowDataPacket[]>(
        `
        SELECT column_name
        FROM information_schema.key_column_usage
        WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = 'PRIMARY';
      `,
        [tableName],
      );

      const [fkRows] = await conn.query<RowDataPacket[]>(
        `
        SELECT
          column_name AS from_column,
          referenced_table_name AS to_table,
          referenced_column_name AS to_column
        FROM information_schema.key_column_usage
        WHERE table_schema = DATABASE() AND table_name = ? AND referenced_table_name IS NOT NULL;
      `,
        [tableName],
      );

      let sampleRows: SqlRow[] = [];
      try {
        const [samples] = await conn.query<RowDataPacket[]>(
          `SELECT * FROM \`${tableName.replace(/`/g, "``")}\` LIMIT 5;`,
        );
        sampleRows = samples as SqlRow[];
      } catch {
        sampleRows = [];
      }

      const primaryKeys = pkRows.map((r) =>
        String(r.column_name ?? r.COLUMN_NAME),
      );
      const foreignKeys = fkRows.map((r) => ({
        from: String(r.from_column),
        table: String(r.to_table),
        to: String(r.to_column),
      }));

      tables.push({
        name: tableName,
        columns: colRows.map((c) => ({
          cid: Number(c.ordinal_position ?? c.ORDINAL_POSITION),
          name: String(c.column_name ?? c.COLUMN_NAME),
          type: String(c.data_type ?? c.DATA_TYPE),
          notNull: String(c.is_nullable ?? c.IS_NULLABLE) === "NO",
          defaultValue:
            c.column_default !== null ? String(c.column_default) : null,
          primaryKey: primaryKeys.includes(
            String(c.column_name ?? c.COLUMN_NAME),
          ),
        })),
        sampleRows,
        primaryKey: primaryKeys.length > 0 ? primaryKeys : undefined,
        foreignKeys,
      });
    }

    return tables;
  }

  async getServerVersion(): Promise<string> {
    if (!this.connection) await this.connect();
    const [rows] = await this.connection!.query<RowDataPacket[]>(
      "SELECT VERSION() AS version;",
    );
    return String(rows[0]?.version ?? "MySQL");
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connection) await this.connect();
      const [rows] =
        await this.connection!.query<RowDataPacket[]>("SELECT 1 AS ok;");
      return rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  async listDatabases(): Promise<string[]> {
    if (!this.connection) await this.connect();
    const [rows] =
      await this.connection!.query<RowDataPacket[]>("SHOW DATABASES;");
    const system = new Set([
      "information_schema",
      "mysql",
      "performance_schema",
      "sys",
    ]);
    return rows
      .map((row) => String(row.Database ?? row.database))
      .filter((name) => !system.has(name));
  }

  async useDatabase(name: string): Promise<void> {
    if (name.toLowerCase() === (this.config.database ?? "").toLowerCase())
      return;
    const known = await this.listDatabases();
    const target = known.find(
      (entry) => entry.toLowerCase() === name.toLowerCase(),
    );
    if (target === undefined) {
      throw new Error(
        `Database "${name}" does not exist on this MySQL server.`,
      );
    }
    await this.connection!.query(`USE \`${target.replace(/`/g, "``")}\`;`);
    this.config = { ...this.config, database: target };
  }

  currentDatabase(): string {
    return this.config.database ?? "LogixZenPractice";
  }

  async resetDatabase(setupSql: string): Promise<void> {
    if (!this.connection) await this.connect();
    const conn = this.connection!;
    const [tableRows] = await conn.query<RowDataPacket[]>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type IN ('BASE TABLE', 'VIEW');",
    );
    const names = tableRows
      .map((row) => String(row.table_name ?? row.TABLE_NAME))
      .filter((name) => name.length > 0);
    if (names.length > 0) {
      await conn.query("SET FOREIGN_KEY_CHECKS = 0;");
      try {
        for (const name of names) {
          await conn.query(
            `DROP VIEW IF EXISTS \`${name.replace(/`/g, "``")}\`;`,
          );
          await conn.query(
            `DROP TABLE IF EXISTS \`${name.replace(/`/g, "``")}\`;`,
          );
        }
      } finally {
        await conn.query("SET FOREIGN_KEY_CHECKS = 1;");
      }
    }
    const statements = splitSqlStatements(setupSql).filter(
      (statement) =>
        parseCreateDatabase(statement.sql) === null &&
        parseUseStatement(statement.sql) === null,
    );
    for (const statement of statements) {
      await conn.query(statement.sql);
    }
  }
}
