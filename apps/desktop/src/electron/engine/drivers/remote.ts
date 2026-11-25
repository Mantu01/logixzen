import { Client as PgClient } from "pg";
import mysql, {
  type Connection as MysqlConnection,
  type FieldPacket,
  type RowDataPacket,
} from "mysql2/promise";
import { Connection as TdsConnection, Request as TdsRequest } from "tedious";
import type { EngineDialect } from "../../../shared/engines";
import type {
  SqlResult,
  TableInfo,
} from "../../../shared/desktop-api";
import { formatSqlRow } from "../value-formatter";
import { splitScript } from "../script-splitter";
import { emptyResult, type EngineDriver, type SqlOptions } from "./base";

const PRACTICE_DB = "LogixZenPractice";
const MAX_ROWS = 10000;

export interface RemoteConfig {
  dialect: Extract<EngineDialect, "postgres" | "mysql" | "tsql">;
  port: number;
  user: string;
  password: string;
}

abstract class RemoteDriver implements EngineDriver {
  abstract readonly dialect: EngineDialect;
  protected database = PRACTICE_DB;

  constructor(protected readonly config: RemoteConfig) {}

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract execute(sql: string, options?: SqlOptions): Promise<SqlResult[]>;
  abstract cancel(): Promise<void>;
  abstract getSchema(): Promise<TableInfo[]>;
  abstract listDatabases(): Promise<string[]>;
  abstract useDatabase(name: string): Promise<void>;
  abstract healthCheck(): Promise<boolean>;
  abstract getServerVersion(): Promise<string>;

  public currentDatabase(): string {
    return this.database;
  }
}

class RemotePostgres extends RemoteDriver {
  readonly dialect: EngineDialect = "postgres";
  private client: PgClient | null = null;
  private admin: PgClient | null = null;

  constructor(config: RemoteConfig) {
    super(config);
  }

  private options(database: string): ConstructorParameters<typeof PgClient>[0] {
    return {
      host: "127.0.0.1",
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database,
      ssl: false,
      connectionTimeoutMillis: 5000,
    };
  }

  public async connect(): Promise<void> {
    this.client = new PgClient(this.options(this.database));
    await this.client.connect();
    this.admin = new PgClient(this.options("postgres"));
    await this.admin.connect();
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client?.end();
    } catch {}
    try {
      await this.admin?.end();
    } catch {}
    this.client = null;
    this.admin = null;
  }

  public async execute(sql: string, options?: SqlOptions): Promise<SqlResult[]> {
    if (this.client === null) throw new Error("PostgreSQL is not connected.");
    return this.executeOnClient(this.client, sql, options);
  }

  private async executeOnClient(
    client: PgClient,
    sql: string,
    options?: SqlOptions,
  ): Promise<SqlResult[]> {
    const started = performance.now();
    const response = await client.query(sql);
    const elapsed = Math.round(performance.now() - started);
    const batch = Array.isArray(response) ? response : [response];
    const maxRows = options?.maxRows ?? MAX_ROWS;
    if (batch.length === 0) {
      return [emptyResult(0, started, undefined, "Statement completed.")];
    }
    return batch.map((result, index) => {
      const columns = result.fields.map((field: { name: string }) => field.name);
      return {
        columns,
        rows: result.rows
          .slice(0, maxRows)
          .map((row: Record<string, unknown>) => formatSqlRow(row)),
        rowsAffected: result.rowCount ?? 0,
        executionTimeMs: elapsed,
        isSelect: columns.length > 0,
        statementIndex: index,
      };
    });
  }

  public async isolatedRun(setupSql: string, sql: string): Promise<SqlResult[]> {
    if (this.admin === null) throw new Error("PostgreSQL is not connected.");
    const started = performance.now();
    const tempDb = `logixzen_iso_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    let tempClient: PgClient | null = null;
    try {
      await this.admin.query(`CREATE DATABASE "${tempDb}"`);
      tempClient = new PgClient(this.options(tempDb));
      await tempClient.connect();
      if (setupSql.trim().length > 0) {
        await tempClient.query(setupSql);
      }
      return await this.executeOnClient(tempClient, sql, {
        maxRows: Number.MAX_SAFE_INTEGER,
      });
    } catch (error) {
      return [
        emptyResult(
          0,
          started,
          error instanceof Error ? error.message : String(error),
        ),
      ];
    } finally {
      try {
        await tempClient?.end();
      } catch {}
      try {
        await this.admin.query(`DROP DATABASE IF EXISTS "${tempDb}" WITH (FORCE)`);
      } catch {}
    }
  }

  public async cancel(): Promise<void> {
    const pid = (this.client as unknown as { processID?: number } | null)
      ?.processID;
    if (this.admin !== null && typeof pid === "number") {
      try {
        await this.admin.query("SELECT pg_cancel_backend($1)", [pid]);
      } catch {}
    }
  }

  public async getSchema(): Promise<TableInfo[]> {
    if (this.client === null) return [];
    const tables = await this.client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
    );
    const schema: TableInfo[] = [];
    for (const table of tables.rows as Array<{ table_name: string }>) {
      const name = table.table_name;
      const columns = await this.client.query(
        "SELECT ordinal_position AS cid, column_name AS name, data_type AS type, is_nullable, column_default AS default_value FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
        [name],
      );
      const pkRows = await this.client.query(
        "SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1",
        [name],
      );
      const pkSet = new Set(pkRows.rows.map((r) => String(r.column_name)));
      const fkRows = await this.client.query(
        "SELECT kcu.column_name AS from_column, ccu.table_name AS target_table, ccu.column_name AS target_column FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name = $1",
        [name],
      );
      const sample = await this.client.query(
        `SELECT * FROM "${name.replace(/"/g, '""')}" LIMIT 5`,
      );
      const mapped = columns.rows.map((column) => ({
        cid: Number(column.cid),
        name: String(column.name),
        type: String(column.type),
        notNull: column.is_nullable === "NO",
        defaultValue: column.default_value,
        primaryKey: pkSet.has(String(column.name)),
      }));
      const primary = mapped.filter((c) => c.primaryKey).map((c) => c.name);
      schema.push({
        name,
        columns: mapped,
        sampleRows: sample.rows.map((row) => formatSqlRow(row)),
        primaryKey: primary.length > 0 ? primary : undefined,
        foreignKeys: fkRows.rows.map((row) => ({
          from: String(row.from_column),
          table: String(row.target_table),
          to: String(row.target_column),
        })),
      });
    }
    return schema;
  }

  public async listDatabases(): Promise<string[]> {
    if (this.client === null) return [this.database];
    const result = await this.client.query(
      "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
    );
    return result.rows.map((row) => String(row.datname));
  }

  public async useDatabase(name: string): Promise<void> {
    this.database = name;
    if (this.client !== null) {
      try {
        await this.client.end();
      } catch {}
      this.client = new PgClient(this.options(name));
      await this.client.connect();
    }
  }

  public async initializeDatabase(
    setupSql?: string,
    name?: string,
    reset = false,
  ): Promise<void> {
    if (this.admin === null) await this.connect();
    const dbName = normalizeRemoteDbName(name);
    if (reset && dbName !== "postgres") {
      if (this.database === dbName && this.client !== null) {
        await this.useDatabase("postgres");
      }
      await this.admin!.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    }
    const exists = await this.admin!.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (exists.rows.length === 0) {
      await this.admin!.query(`CREATE DATABASE "${dbName}"`);
    }
    await this.useDatabase(dbName);
    if (setupSql !== undefined && setupSql.trim().length > 0) {
      const current = await this.getSchema();
      if (reset || current.length === 0) {
        await this.execute(setupSql);
      }
    }
  }

  public async healthCheck(): Promise<boolean> {
    if (this.client === null) return false;
    try {
      const result = await this.client.query("SELECT 1 AS ok");
      return result.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  public async getServerVersion(): Promise<string> {
    if (this.client === null) return "PostgreSQL";
    const result = await this.client.query("SELECT version() AS version");
    return String(result.rows[0]?.version ?? "PostgreSQL");
  }
}

class RemoteMysql extends RemoteDriver {
  readonly dialect: EngineDialect;
  private connection: MysqlConnection | null = null;
  private admin: MysqlConnection | null = null;

  constructor(config: RemoteConfig) {
    super(config);
    this.dialect = config.dialect;
  }

  private options(database?: string): mysql.ConnectionOptions {
    return {
      host: "127.0.0.1",
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database,
      multipleStatements: true,
      connectTimeout: 5000,
    };
  }

  public async connect(): Promise<void> {
    this.connection = await mysql.createConnection(this.options(this.database));
    this.admin = await mysql.createConnection(this.options());
  }

  public async disconnect(): Promise<void> {
    try {
      await this.connection?.end();
    } catch {}
    try {
      await this.admin?.end();
    } catch {}
    this.connection = null;
    this.admin = null;
  }

  public async execute(sql: string, options?: SqlOptions): Promise<SqlResult[]> {
    if (this.connection === null) throw new Error("MySQL is not connected.");
    return this.executeOnConnection(this.connection, sql, options);
  }

  private async executeOnConnection(
    connection: MysqlConnection,
    sql: string,
    options?: SqlOptions,
  ): Promise<SqlResult[]> {
    const started = performance.now();
    const [rawResults, rawFields] = await connection.query(sql);
    const elapsed = Math.round(performance.now() - started);
    const maxRows = options?.maxRows ?? MAX_ROWS;
    const sets = Array.isArray(rawResults)
      ? (rawResults as unknown[])
      : [rawResults];
    const fields = (
      Array.isArray(rawFields) && Array.isArray(rawFields[0])
        ? rawFields
        : [rawFields]
    ) as FieldPacket[][];

    if (sets.length === 0) {
      return [emptyResult(0, started, undefined, "Statement completed.")];
    }

    return sets.map((item, index) => {
      if (Array.isArray(item)) {
        const rows = item as RowDataPacket[];
        const columns = (fields[index] ?? []).map((field) => field.name);
        return {
          columns,
          rows: rows
            .slice(0, maxRows)
            .map((row) => formatSqlRow(row as Record<string, unknown>)),
          rowsAffected: 0,
          executionTimeMs: elapsed,
          isSelect: true,
          statementIndex: index,
        };
      }
      const header = (item ?? {}) as { affectedRows?: number };
      return {
        columns: [],
        rows: [],
        rowsAffected: header.affectedRows ?? 0,
        executionTimeMs: elapsed,
        isSelect: false,
        statementIndex: index,
      };
    });
  }

  public async isolatedRun(setupSql: string, sql: string): Promise<SqlResult[]> {
    if (this.admin === null) throw new Error("MySQL is not connected.");
    const started = performance.now();
    const tempDb = `logixzen_iso_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    let tempConn: MysqlConnection | null = null;
    try {
      await this.admin.query(`CREATE DATABASE \`${tempDb}\``);
      tempConn = await mysql.createConnection(this.options(tempDb));
      if (setupSql.trim().length > 0) {
        await tempConn.query(setupSql);
      }
      return await this.executeOnConnection(tempConn, sql, {
        maxRows: Number.MAX_SAFE_INTEGER,
      });
    } catch (error) {
      return [
        emptyResult(
          0,
          started,
          error instanceof Error ? error.message : String(error),
        ),
      ];
    } finally {
      try {
        await tempConn?.end();
      } catch {}
      try {
        await this.admin.query(`DROP DATABASE IF EXISTS \`${tempDb}\``);
      } catch {}
    }
  }

  public async cancel(): Promise<void> {
    if (this.connection === null || this.admin === null) return;
    const threadId = this.connection.threadId;
    if (typeof threadId === "number") {
      try {
        await this.admin.query(`KILL QUERY ${threadId}`);
      } catch {}
    }
  }

  public async getSchema(): Promise<TableInfo[]> {
    if (this.connection === null) return [];
    const [tables] = await this.connection.query<RowDataPacket[]>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name",
      [this.database],
    );
    const schema: TableInfo[] = [];
    for (const table of tables) {
      const name = String(table.table_name);
      const [columns] = await this.connection.query<RowDataPacket[]>(
        "SELECT ordinal_position AS cid, column_name AS name, column_type AS type, is_nullable, column_default AS default_value, column_key AS key_type FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position",
        [this.database, name],
      );
      const [keyRows] = await this.connection.query<RowDataPacket[]>(
        "SELECT column_name AS from_column, referenced_table_name AS target_table, referenced_column_name AS target_column FROM information_schema.key_column_usage WHERE table_schema = ? AND table_name = ? AND referenced_table_name IS NOT NULL",
        [this.database, name],
      );
      const [sample] = await this.connection.query<RowDataPacket[]>(
        `SELECT * FROM \`${name.replace(/`/g, "``")}\` LIMIT 5`,
      );
      const mapped = columns.map((column) => ({
        cid: Number(column.cid),
        name: String(column.name),
        type: String(column.type),
        notNull: column.is_nullable === "NO",
        defaultValue: column.default_value,
        primaryKey: column.key_type === "PRI",
      }));
      const primary = mapped.filter((c) => c.primaryKey).map((c) => c.name);
      schema.push({
        name,
        columns: mapped,
        sampleRows: sample.map((row) =>
          formatSqlRow(row as Record<string, unknown>),
        ),
        primaryKey: primary.length > 0 ? primary : undefined,
        foreignKeys: keyRows.map((row) => ({
          from: String(row.from_column),
          table: String(row.target_table),
          to: String(row.target_column),
        })),
      });
    }
    return schema;
  }

  public async listDatabases(): Promise<string[]> {
    if (this.connection === null) return [this.database];
    const [rows] = await this.connection.query<RowDataPacket[]>("SHOW DATABASES");
    return rows.map((row) => String(Object.values(row)[0]));
  }

  public async useDatabase(name: string): Promise<void> {
    this.database = name;
    if (this.connection !== null) {
      await this.connection.query(`USE \`${name.replace(/`/g, "``")}\``);
    }
  }

  public async initializeDatabase(
    setupSql?: string,
    name?: string,
    reset = false,
  ): Promise<void> {
    if (this.admin === null) await this.connect();
    const dbName = normalizeRemoteDbName(name);
    if (reset) {
      await this.admin!.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    }
    await this.admin!.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await this.useDatabase(dbName);
    if (setupSql !== undefined && setupSql.trim().length > 0) {
      const current = await this.getSchema();
      if (reset || current.length === 0) {
        await this.execute(setupSql);
      }
    }
  }

  public async healthCheck(): Promise<boolean> {
    if (this.connection === null) return false;
    try {
      const [rows] = await this.connection.query<RowDataPacket[]>(
        "SELECT 1 AS ok",
      );
      return (rows[0] as { ok?: number } | undefined)?.ok === 1;
    } catch {
      return false;
    }
  }

  public async getServerVersion(): Promise<string> {
    if (this.connection === null) return "MySQL";
    const [rows] = await this.connection.query<RowDataPacket[]>(
      "SELECT VERSION() AS version",
    );
    return String((rows[0] as { version?: string } | undefined)?.version);
  }
}

class RemoteTsql extends RemoteDriver {
  readonly dialect: EngineDialect = "tsql";
  private connection: TdsConnection | null = null;

  constructor(config: RemoteConfig) {
    super(config);
  }

  private connectToDatabase(database: string): Promise<TdsConnection> {
    return new Promise((resolve, reject) => {
      const connection = new TdsConnection({
        server: "127.0.0.1",
        authentication: {
          type: "default",
          options: {
            userName: this.config.user,
            password: this.config.password,
          },
        },
        options: {
          port: this.config.port,
          database,
          encrypt: false,
          trustServerCertificate: true,
          connectTimeout: 10000,
          requestTimeout: 30000,
        },
      });
      connection.on("connect", (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(connection);
      });
      connection.connect();
    });
  }

  public async connect(): Promise<void> {
    this.connection = await this.connectToDatabase(this.database);
  }

  public async disconnect(): Promise<void> {
    try {
      this.connection?.close();
    } catch {}
    this.connection = null;
  }

  public async execute(sql: string, options?: SqlOptions): Promise<SqlResult[]> {
    if (this.connection === null) throw new Error("SQL Server is not connected.");
    return this.executeOnConnection(this.connection, sql, options);
  }

  private async executeOnConnection(
    connection: TdsConnection,
    sql: string,
    options?: SqlOptions,
  ): Promise<SqlResult[]> {
    const { statements, error } = splitScript(sql, "tsql");
    if (error !== null) throw new Error(error);
    const maxRows = options?.maxRows ?? MAX_ROWS;
    const results: SqlResult[] = [];

    for (let index = 0; index < statements.length; index += 1) {
      const started = performance.now();
      const result = await new Promise<SqlResult>((resolve, reject) => {
        const columns: string[] = [];
        const rows: Array<Record<string, unknown>> = [];
        const messages: string[] = [];
        const request = new TdsRequest(statements[index]!, (requestError, count) => {
          if (requestError) {
            reject(requestError);
            return;
          }
          resolve({
            columns,
            rows: rows.slice(0, maxRows).map(formatSqlRow),
            rowsAffected: count ?? 0,
            executionTimeMs: Math.round(performance.now() - started),
            isSelect: columns.length > 0,
            statementIndex: index,
            message: messages.length > 0 ? messages.join("\n") : undefined,
          });
        });
        request.on("columnMetadata", (metadata) => {
          const list = Array.isArray(metadata)
            ? metadata
            : Object.values(metadata);
          for (const column of list) {
            if (!columns.includes(column.colName)) {
              columns.push(column.colName);
            }
          }
        });
        request.on("row", (values) => {
          const row: Record<string, unknown> = {};
          for (const value of values) {
            row[value.metadata.colName] = value.value;
          }
          rows.push(row);
        });
        connection.execSql(request);
      });
      results.push(result);
    }

    return results;
  }

  public async isolatedRun(setupSql: string, sql: string): Promise<SqlResult[]> {
    if (this.connection === null) throw new Error("SQL Server is not connected.");
    const started = performance.now();
    const tempDb = `logixzen_iso_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    let tempConn: TdsConnection | null = null;
    try {
      await this.executeOnConnection(
        this.connection,
        `CREATE DATABASE [${tempDb}];`,
      );
      tempConn = await this.connectToDatabase(tempDb);
      if (setupSql.trim().length > 0) {
        await this.executeOnConnection(tempConn, setupSql, {
          maxRows: Number.MAX_SAFE_INTEGER,
        });
      }
      return await this.executeOnConnection(tempConn, sql, {
        maxRows: Number.MAX_SAFE_INTEGER,
      });
    } catch (error) {
      return [
        emptyResult(
          0,
          started,
          error instanceof Error ? error.message : String(error),
        ),
      ];
    } finally {
      try {
        tempConn?.close();
      } catch {}
      try {
        await this.executeOnConnection(
          this.connection,
          `IF DB_ID(N'${tempDb}') IS NOT NULL BEGIN ALTER DATABASE [${tempDb}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${tempDb}]; END`,
        );
      } catch {}
    }
  }

  public async cancel(): Promise<void> {
    try {
      this.connection?.cancel();
    } catch {}
  }

  public async getSchema(): Promise<TableInfo[]> {
    if (this.connection === null) return [];
    const tables = await this.execute(
      "SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
    );
    const schema: TableInfo[] = [];
    for (const row of tables[0]?.rows ?? []) {
      const name = String(row.name);
      const columnsResult = await this.execute(
        `SELECT ORDINAL_POSITION AS cid, COLUMN_NAME AS name, DATA_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS default_value FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${name.replace(/'/g, "''")}' ORDER BY ORDINAL_POSITION`,
      );
      const pkResult = await this.execute(
        `SELECT kcu.COLUMN_NAME AS name FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND tc.TABLE_NAME = '${name.replace(/'/g, "''")}'`,
      );
      const pkSet = new Set(
        (pkResult[0]?.rows ?? []).map((row) => String(row.name)),
      );
      let foreignKeys: TableInfo["foreignKeys"] = [];
      try {
        const fkResult = await this.execute(
          `SELECT COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS from_column, OBJECT_NAME(fkc.referenced_object_id) AS target_table, COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS target_column FROM sys.foreign_key_columns fkc WHERE fkc.parent_object_id = OBJECT_ID(N'${name.replace(/'/g, "''")}')`,
        );
        foreignKeys = (fkResult[0]?.rows ?? []).map((row) => ({
          from: String(row.from_column),
          table: String(row.target_table),
          to: String(row.target_column),
        }));
      } catch {}
      const sample = await this.execute(
        `SELECT TOP 5 * FROM [${name.replace(/\]/g, "]]")}]`,
      );
      const mapped = (columnsResult[0]?.rows ?? []).map((column) => ({
        cid: Number(column.cid),
        name: String(column.name),
        type: String(column.type),
        notNull: column.nullable === "NO",
        defaultValue: column.default_value,
        primaryKey: pkSet.has(String(column.name)),
      }));
      const primary = mapped.filter((c) => c.primaryKey).map((c) => c.name);
      schema.push({
        name,
        columns: mapped,
        sampleRows: sample[0]?.rows ?? [],
        primaryKey: primary.length > 0 ? primary : undefined,
        foreignKeys,
      });
    }
    return schema;
  }

  public async listDatabases(): Promise<string[]> {
    const result = await this.execute(
      "SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name",
    );
    return (result[0]?.rows ?? []).map((row) => String(row.name));
  }

  public async useDatabase(name: string): Promise<void> {
    await this.execute(`USE [${name.replace(/\]/g, "]]")}]`);
    this.database = name;
  }

  public async initializeDatabase(
    setupSql?: string,
    name?: string,
    reset = false,
  ): Promise<void> {
    if (this.connection === null) await this.connect();
    const dbName = normalizeRemoteDbName(name);
    if (reset && dbName !== "master") {
      if (this.database === dbName) {
        await this.useDatabase("master");
      }
      await this.execute(
        `IF DB_ID(N'${dbName}') IS NOT NULL BEGIN ALTER DATABASE [${dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${dbName}]; END`,
      );
    }
    await this.execute(
      `IF DB_ID(N'${dbName}') IS NULL CREATE DATABASE [${dbName}];`,
    );
    await this.useDatabase(dbName);
    if (setupSql !== undefined && setupSql.trim().length > 0) {
      const current = await this.getSchema();
      if (reset || current.length === 0) {
        await this.execute(setupSql);
      }
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.execute("SELECT 1 AS ok");
      return result[0]?.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  public async getServerVersion(): Promise<string> {
    const result = await this.execute("SELECT @@VERSION AS version");
    const version = result[0]?.rows[0]?.version;
    return typeof version === "string" ? version.split("\n")[0]!.trim() : "SQL Server";
  }
}

export function createRemoteDriver(config: RemoteConfig): EngineDriver {
  if (config.dialect === "postgres") return new RemotePostgres(config);
  if (config.dialect === "tsql") return new RemoteTsql(config);
  return new RemoteMysql(config);
}

function normalizeRemoteDbName(name?: string): string {
  if (name === undefined || name.trim().length === 0) return PRACTICE_DB;
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.length > 0 ? cleaned : PRACTICE_DB;
}
