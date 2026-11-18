import { Connection, Request } from "tedious";
import type { SqlResult, SqlRow, TableInfo } from "../../../shared/desktop-api";
import {
  parseCreateDatabase,
  parseUseStatement,
  splitBatches,
  splitSqlStatements,
} from "../../../shared/sql";
import type { DatabaseDriver } from "./driver";
import { translateDriverError } from "./driver";

export interface TdsConfig {
  server?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

interface TediousColumn {
  metadata: {
    colName: string;
  };
  value: unknown;
}

export class TdsDriver implements DatabaseDriver {
  readonly dialect = "tsql" as const;
  private connection: Connection | null = null;
  private config: TdsConfig;

  constructor(config: TdsConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connection) return;

    return new Promise<void>((resolve, reject) => {
      const conn = new Connection({
        server: this.config.server ?? "127.0.0.1",
        authentication: {
          type: "default",
          options: {
            userName: this.config.user ?? "logixzen_user",
            password: this.config.password ?? "",
          },
        },
        options: {
          port: this.config.port ?? 1433,
          database: this.config.database ?? "LogixZenPractice",
          encrypt: false,
          trustServerCertificate: true,
          connectTimeout: 5000,
          requestTimeout: 15000,
          rowCollectionOnRequestCompletion: false,
        },
      });

      conn.on("connect", (err) => {
        if (err) {
          reject(err);
        } else {
          this.connection = conn;
          resolve();
        }
      });

      conn.on("error", () => {
        this.connection = null;
      });

      conn.connect();
    });
  }

  async disconnect(): Promise<void> {
    if (!this.connection) return;
    try {
      this.connection.close();
    } catch {
    } finally {
      this.connection = null;
    }
  }

  private async executeSingleStatement(
    sql: string,
    statementIndex: number,
  ): Promise<SqlResult> {
    const started = performance.now();
    if (!this.connection) await this.connect();
    const conn = this.connection!;

    return new Promise<SqlResult>((resolve) => {
      const columns: string[] = [];
      const rows: SqlRow[] = [];
      let isSelect = false;

      const request = new Request(sql, (err, rowCount) => {
        if (err) {
          resolve({
            columns: [],
            rows: [],
            rowsAffected: 0,
            error: translateDriverError(err.message),
            statementIndex,
            isSelect: false,
            executionTimeMs: performance.now() - started,
          });
        } else {
          resolve({
            columns,
            rows,
            rowsAffected: isSelect ? 0 : (rowCount ?? 0),
            statementIndex,
            isSelect,
            executionTimeMs: performance.now() - started,
          });
        }
      });

      request.on("columnMetadata", (meta) => {
        isSelect = true;
        if (Array.isArray(meta)) {
          for (const col of meta) {
            if (col && typeof col.colName === "string") {
              columns.push(col.colName);
            }
          }
        }
      });

      request.on("row", (rowColumns) => {
        if (rows.length < 1000 && Array.isArray(rowColumns)) {
          const rowObj: SqlRow = {};
          for (const col of rowColumns) {
            const item = col as TediousColumn;
            rowObj[item.metadata.colName] = item.value;
          }
          rows.push(rowObj);
        }
      });

      conn.execSql(request);
    });
  }

  async execute(sql: string): Promise<SqlResult[]> {
    if (!this.connection) await this.connect();
    const batches = splitBatches(sql);
    const results: SqlResult[] = [];
    let statementIndex = 0;

    for (const batch of batches) {
      const statements = splitSqlStatements(batch.join("\n"));
      for (const stmt of statements) {
        const res = await this.executeSingleStatement(stmt.sql, statementIndex);
        results.push(res);
        statementIndex += 1;
      }
    }

    return results;
  }

  async getSchema(): Promise<TableInfo[]> {
    if (!this.connection) await this.connect();

    const tablesSql = `
      SELECT t.name AS table_name
      FROM sys.tables t
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE s.name NOT IN ('sys', 'INFORMATION_SCHEMA') AND t.is_ms_shipped = 0
      ORDER BY t.name;
    `;
    const tablesRes = await this.executeSingleStatement(tablesSql, 0);

    const tables: TableInfo[] = [];

    for (const r of tablesRes.rows) {
      const tableName = String(r.table_name);

      const colSql = `
        SELECT c.name AS column_name, ty.name AS type_name, c.is_nullable, c.column_id
        FROM sys.tables t
        JOIN sys.columns c ON t.object_id = c.object_id
        JOIN sys.types ty ON c.user_type_id = ty.user_type_id
        WHERE t.name = '${tableName.replace(/'/g, "''")}'
        ORDER BY c.column_id;
      `;
      const colRes = await this.executeSingleStatement(colSql, 0);

      const pkSql = `
        SELECT c.name AS column_name
        FROM sys.indexes i
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        JOIN sys.tables t ON i.object_id = t.object_id
        WHERE i.is_primary_key = 1 AND t.name = '${tableName.replace(/'/g, "''")}';
      `;
      const pkRes = await this.executeSingleStatement(pkSql, 0);

      const fkSql = `
        SELECT cp.name AS from_column, tr.name AS to_table, cr.name AS to_column
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
        JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
        JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
        JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        WHERE tp.name = '${tableName.replace(/'/g, "''")}';
      `;
      const fkRes = await this.executeSingleStatement(fkSql, 0);

      const sampleSql = `SELECT TOP 5 * FROM [${tableName.replace(/\]/g, "]]")}];`;
      const sampleRes = await this.executeSingleStatement(sampleSql, 0);

      const primaryKeys = pkRes.rows.map((row) => String(row.column_name));
      const foreignKeys = fkRes.rows.map((row) => ({
        from: String(row.from_column),
        table: String(row.to_table),
        to: String(row.to_column),
      }));

      tables.push({
        name: tableName,
        columns: colRes.rows.map((c) => ({
          cid: Number(c.column_id),
          name: String(c.column_name),
          type: String(c.type_name),
          notNull: Number(c.is_nullable) === 0,
          defaultValue: null,
          primaryKey: primaryKeys.includes(String(c.column_name)),
        })),
        sampleRows: sampleRes.rows,
        primaryKey: primaryKeys.length > 0 ? primaryKeys : undefined,
        foreignKeys,
      });
    }

    return tables;
  }

  async getServerVersion(): Promise<string> {
    const res = await this.executeSingleStatement(
      "SELECT @@VERSION AS version;",
      0,
    );
    const ver = res.rows[0]?.version;
    return typeof ver === "string"
      ? (ver.split(/\r?\n/)[0] ?? "SQL Server")
      : "SQL Server";
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.executeSingleStatement("SELECT 1 AS ok;", 0);
      return res.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  async listDatabases(): Promise<string[]> {
    const res = await this.executeSingleStatement(
      "SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name;",
      0,
    );
    return res.rows.map((row) => String(row.name));
  }

  async useDatabase(name: string): Promise<void> {
    if (name.toLowerCase() === (this.config.database ?? "").toLowerCase())
      return;
    const known = await this.listDatabases();
    const target = known.find(
      (entry) => entry.toLowerCase() === name.toLowerCase(),
    );
    if (target === undefined) {
      throw new Error(`Database "${name}" does not exist on this SQL Server.`);
    }
    const res = await this.executeSingleStatement(
      `USE [${target.replace(/]/g, "]]")}];`,
      0,
    );
    if (res.error !== undefined) {
      throw new Error(res.error);
    }
    this.config = { ...this.config, database: target };
  }

  currentDatabase(): string {
    return this.config.database ?? "LogixZenPractice";
  }

  async resetDatabase(setupSql: string): Promise<void> {
    await this.connect();
    for (let guard = 0; guard < 512; guard += 1) {
      const tables = await this.executeSingleStatement(
        "SELECT TOP 1 t.name FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name NOT IN ('sys', 'INFORMATION_SCHEMA') AND t.is_ms_shipped = 0;",
        0,
      );
      const table = tables.rows[0]?.table;
      if (table === undefined) break;
      const dropped = await this.executeSingleStatement(
        `DROP TABLE [${String(table).replace(/\]/g, "]]")}];`,
        0,
      );
      if (dropped.error !== undefined) throw new Error(dropped.error);
    }
    const views = await this.executeSingleStatement(
      "SELECT t.name FROM sys.views t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name NOT IN ('sys', 'INFORMATION_SCHEMA');",
      0,
    );
    for (const row of views.rows) {
      await this.executeSingleStatement(
        `DROP VIEW [${String(row.name).replace(/\]/g, "]]")}];`,
        0,
      );
    }
    const statements = splitSqlStatements(setupSql).filter(
      (statement) =>
        parseCreateDatabase(statement.sql) === null &&
        parseUseStatement(statement.sql) === null,
    );
    for (const statement of statements) {
      const res = await this.executeSingleStatement(statement.sql, 0);
      if (res.error !== undefined) throw new Error(res.error);
    }
  }
}
