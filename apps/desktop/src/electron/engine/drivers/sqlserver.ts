import sql from "msnodesqlv8";

type SqlConnection = Awaited<ReturnType<typeof sql.promises.open>>;
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { EngineDialect } from "../../../shared/engines";
import type {
  SqlResult,
  TableInfo,
} from "../../../shared/desktop-api";
import { formatSqlRow } from "../value-formatter";
import { splitScript } from "../script-splitter";
import { emptyResult, type EngineDriver, type SqlOptions } from "./base";

const INSTANCE = "LogixZenPractice";
const PRACTICE_DB = "practice";
const DEFAULT_MAX_ROWS = 10000;
const ODBC_DRIVERS = [
  "ODBC Driver 18 for SQL Server",
  "ODBC Driver 17 for SQL Server",
  "ODBC Driver 13 for SQL Server",
  "SQL Server Native Client 11.0",
];

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function run(
  executable: string,
  args: string[],
  timeoutMs = 30000,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      executable,
      args,
      { windowsHide: true, timeout: timeoutMs },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          exitCode: error === null ? 0 : 1,
        });
      },
    );
  });
}

function localDbBinary(): string {
  if (process.platform !== "win32") return "sqllocaldb.exe";
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const candidates = ["170", "160", "150", "140", "130", "120"];
  for (const version of candidates) {
    const candidate = join(
      programFiles,
      "Microsoft SQL Server",
      version,
      "Tools",
      "Binn",
      "SqlLocalDB.exe",
    );
    if (existsSync(candidate)) return candidate;
  }
  return "sqllocaldb.exe";
}

export class SqlServerDriver implements EngineDriver {
  readonly dialect: EngineDialect = "tsql";
  private connection: SqlConnection | null = null;
  private admin: SqlConnection | null = null;
  private driverName: string | null = null;
  private pipe: string | null = null;
  private spid: number | null = null;
  private database = PRACTICE_DB;

  private async ensureInstance(): Promise<void> {
    if (process.platform !== "win32") {
      throw new Error("SQL Server LocalDB requires Windows.");
    }
    const binary = localDbBinary();
    const info = await run(binary, ["info", INSTANCE]);
    const exists = /Name:\s*\S+/i.test(info.stdout);
    if (!exists) {
      const created = await run(binary, ["create", INSTANCE]);
      if (created.exitCode !== 0 && !/already exists/i.test(created.stdout + created.stderr)) {
        throw new Error(
          `Could not create the LocalDB instance: ${(created.stderr || created.stdout).trim()}`,
        );
      }
    }
    const startResult = await run(binary, ["start", INSTANCE], 60000);
    const started = await run(binary, ["info", INSTANCE]);
    const pipeMatch = /Instance pipe name:\s*(np:[^\r\n]+)/i.exec(started.stdout);
    const pipeLine = pipeMatch?.[1]?.trim();
    if (!pipeLine) {
      throw new Error(
        `SQL Server LocalDB pipe name is unavailable (${(startResult.stderr || startResult.stdout || started.stderr || started.stdout).trim()}).`,
      );
    }
    this.pipe = pipeLine;
  }

  private buildConnection(database: string): string {
    if (this.pipe === null) {
      throw new Error("SQL Server LocalDB is not started.");
    }
    const driver = this.driverName ?? ODBC_DRIVERS[0]!;
    return [
      `Driver={${driver}}`,
      `Server=${this.pipe}`,
      `Database=${database}`,
      "Trusted_Connection=Yes",
      "Encrypt=No",
      "TrustServerCertificate=Yes",
      "Connect Timeout=10",
    ].join(";");
  }

  public async connect(): Promise<void> {
    await this.ensureInstance();

    let lastError: unknown = new Error("No ODBC driver is available.");
    for (const driver of ODBC_DRIVERS) {
      this.driverName = driver;
      try {
        const connection = await sql.promises.open(
          this.buildConnection("master"),
        );
        const probe = await connection.promises.query(
          "SELECT @@SPID AS spid",
        );
        const spid = (
          probe.results[0]?.[0] as { spid?: number } | undefined
        )?.spid;
        this.spid = typeof spid === "number" ? spid : null;
        this.admin = connection;
        break;
      } catch (error) {
        lastError = error;
        this.admin = null;
      }
    }

    if (this.admin === null) {
      throw new Error(
        `SQL Server requires the Microsoft ODBC Driver. Install it and retry: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
      );
    }

    await this.admin.promises.query(
      `IF DB_ID(N'${PRACTICE_DB}') IS NULL CREATE DATABASE [${PRACTICE_DB}]`,
    );

    this.connection = await sql.promises.open(
      this.buildConnection(PRACTICE_DB),
    );
    try {
      await this.connection.promises.query("SELECT 1 AS ok");
    } catch (error) {
      await this.connection.promises.close();
      this.connection = null;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.connection !== null) {
      try {
        await this.connection.promises.close();
      } catch {}
      this.connection = null;
    }
    if (this.admin !== null) {
      try {
        await this.admin.promises.close();
      } catch {}
      this.admin = null;
    }
    const binary = localDbBinary();
    await run(binary, ["stop", INSTANCE, "-k"]);
  }

  public async execute(
    sqlText: string,
    options?: SqlOptions,
  ): Promise<SqlResult[]> {
    if (this.connection === null) {
      throw new Error("SQL Server session is not open.");
    }
    return this.executeOnConnection(this.connection, sqlText, options, true);
  }

  private async executeOnConnection(
    connection: SqlConnection,
    sqlText: string,
    options?: SqlOptions,
    trackDatabase = false,
  ): Promise<SqlResult[]> {
    const started = performance.now();
    const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;
    const split = splitScript(sqlText, "tsql");
    if (split.error !== undefined) {
      return [emptyResult(0, started, split.error)];
    }
    const batches = split.statements.length > 0 ? split.statements : [sqlText];
    const results: SqlResult[] = [];
    const allInfo: string[] = [];

    for (const batch of batches) {
      const batchStart = performance.now();
      try {
        const result = await connection.promises.query(
          batch,
          [],
          options?.timeoutMs ? { timeoutMs: options.timeoutMs } : undefined,
        );
        const elapsed = Math.round(performance.now() - batchStart);
        const info = result.info ?? [];
        allInfo.push(...info);

        if (result.results.length === 0) {
          results.push(
            emptyResult(
              results.length,
              batchStart,
              undefined,
              info.join("\n") || "Statement completed.",
            ),
          );
          continue;
        }

        for (let index = 0; index < result.results.length; index += 1) {
          const rawRows = result.results[index] ?? [];
          const meta = result.meta[index] ?? [];
          const columns = meta.map((column: { name: string }) => column.name);
          const rows = rawRows
            .slice(0, maxRows)
            .map((row: unknown) => formatSqlRow(row as Record<string, unknown>));
          const count = result.counts[index];
          results.push({
            columns,
            rows,
            rowsAffected: typeof count === "number" ? count : 0,
            executionTimeMs: elapsed,
            isSelect: columns.length > 0,
            statementIndex: results.length,
            message:
              columns.length === 0 && info[index] !== undefined
                ? info[index]
                : undefined,
          });
        }
      } catch (error) {
        results.push(
          emptyResult(
            results.length,
            batchStart,
            error instanceof Error ? error.message : String(error),
          ),
        );
      }
    }

    if (trackDatabase && connection === this.connection) {
      try {
        const dbRes = await connection.promises.query("SELECT DB_NAME() AS db");
        const activeDb = (
          dbRes.results[0]?.[0] as { db?: string } | undefined
        )?.db;
        if (typeof activeDb === "string" && activeDb.length > 0) {
          this.database = activeDb;
        }
      } catch {}
    }

    if (results.length === 0) {
      return [
        emptyResult(0, started, undefined, allInfo.join("\n") || undefined),
      ];
    }

    return results;
  }

  public async isolatedRun(setupSql: string, sqlText: string): Promise<SqlResult[]> {
    if (this.admin === null) {
      throw new Error("SQL Server is not connected.");
    }
    const started = performance.now();
    const tempDb = `logixzen_iso_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    let tempConn: SqlConnection | null = null;
    try {
      await this.admin.promises.query(`CREATE DATABASE [${tempDb}]`);
      tempConn = await sql.promises.open(this.buildConnection(tempDb));
      if (setupSql.trim().length > 0) {
        await this.executeOnConnection(tempConn, setupSql, {
          maxRows: Number.MAX_SAFE_INTEGER,
        });
      }
      return await this.executeOnConnection(tempConn, sqlText, {
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
      if (tempConn !== null) {
        try {
          await tempConn.promises.close();
        } catch {}
      }
      try {
        await this.admin.promises.query(
          `IF DB_ID(N'${tempDb}') IS NOT NULL BEGIN ALTER DATABASE [${tempDb}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${tempDb}]; END`,
        );
      } catch {}
    }
  }

  public async cancel(): Promise<void> {
    if (this.admin === null || this.spid === null) return;
    try {
      await this.admin.promises.query(`KILL ${this.spid}`);
    } catch {}
  }

  public async getSchema(): Promise<TableInfo[]> {
    if (this.connection === null) return [];

    const tables = await this.connection.promises.query(
      `SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
    );

    const schema: TableInfo[] = [];

    for (const row of tables.results[0] ?? []) {
      const name = String((row as { name: string }).name);
      const escaped = name.replace(/'/g, "''");
      const columnsResult = await this.connection.promises.query(
        `SELECT ORDINAL_POSITION AS cid, COLUMN_NAME AS name, DATA_TYPE AS type,
                IS_NULLABLE AS nullable, COLUMN_DEFAULT AS default_value
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_NAME = '${escaped}'
         ORDER BY ORDINAL_POSITION`,
      );

      const primaryResult = await this.connection.promises.query(
        `SELECT kcu.COLUMN_NAME AS name
         FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
         JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
           ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
         WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND tc.TABLE_NAME = '${escaped}'`,
      );

      const primary = new Set(
        (primaryResult.results[0] ?? []).map((entry: unknown) =>
          String((entry as { name: string }).name),
        ),
      );

      const columns = (columnsResult.results[0] ?? []).map((entry: unknown) => {
        const column = entry as {
          cid: number;
          name: string;
          type: string;
          nullable: string;
          default_value: unknown;
        };
        return {
          cid: Number(column.cid),
          name: String(column.name),
          type: String(column.type),
          notNull: column.nullable === "NO",
          defaultValue: column.default_value,
          primaryKey: primary.has(String(column.name)),
        };
      });

      let sampleRows: Record<string, unknown>[] = [];
      try {
        const sample = await this.connection.promises.query(
          `SELECT TOP 5 * FROM [${name.replace(/\]/g, "]]")}]`,
        );
        sampleRows = (sample.results[0] ?? []).map((entry: unknown) =>
          formatSqlRow(entry as Record<string, unknown>),
        );
      } catch {}

      let foreignKeys: TableInfo["foreignKeys"] = [];
      try {
        const fkResult = await this.connection.promises.query(
          `SELECT COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS from_column,
                  OBJECT_NAME(fkc.referenced_object_id) AS target_table,
                  COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS target_column
           FROM sys.foreign_key_columns fkc
           WHERE fkc.parent_object_id = OBJECT_ID(N'${escaped}')`,
        );
        foreignKeys = (fkResult.results[0] ?? []).map((entry: unknown) => {
          const fk = entry as {
            from_column: string;
            target_table: string;
            target_column: string;
          };
          return {
            from: String(fk.from_column),
            table: String(fk.target_table),
            to: String(fk.target_column),
          };
        });
      } catch {}

      const primaryColumns = columns
        .filter((column) => column.primaryKey)
        .map((column) => column.name);

      schema.push({
        name,
        columns,
        sampleRows,
        foreignKeys,
        primaryKey:
          primaryColumns.length > 0 ? primaryColumns : undefined,
      });
    }

    return schema;
  }

  public async listDatabases(): Promise<string[]> {
    if (this.connection === null) return [this.database];
    try {
      const result = await this.connection.promises.query(
        "SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name",
      );
      return (result.results[0] ?? []).map((row: unknown) =>
        String((row as { name: string }).name),
      );
    } catch {
      return [this.database];
    }
  }

  public async useDatabase(name: string): Promise<void> {
    if (this.connection === null) {
      this.database = name;
      return;
    }
    await this.connection.promises.query(
      `USE [${name.replace(/\]/g, "]]")}]`,
    );
    this.database = name;
  }

  public async initializeDatabase(
    setupSql?: string,
    name?: string,
    reset = false,
  ): Promise<void> {
    if (this.admin === null) {
      await this.connect();
    }
    const dbName = normalizeDbName(name);
    if (reset && dbName !== "master") {
      if (this.database === dbName && this.connection !== null) {
        await this.useDatabase("master");
      }
      await this.admin!.promises.query(
        `IF DB_ID(N'${dbName}') IS NOT NULL BEGIN ALTER DATABASE [${dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${dbName}]; END`,
      );
    }
    await this.admin!.promises.query(
      `IF DB_ID(N'${dbName}') IS NULL CREATE DATABASE [${dbName}]`,
    );
    await this.useDatabase(dbName);
    if (setupSql !== undefined && setupSql.trim().length > 0) {
      const current = await this.getSchema();
      if (reset || current.length === 0) {
        await this.execute(setupSql);
      }
    }
  }

  public currentDatabase(): string {
    return this.database;
  }

  public async healthCheck(): Promise<boolean> {
    if (this.connection === null) return false;
    try {
      const result = await this.connection.promises.query(
        "SELECT 1 AS ok",
      );
      const value = (result.results[0]?.[0] as { ok?: number } | undefined)?.ok;
      return value === 1;
    } catch {
      return false;
    }
  }

  public async getServerVersion(): Promise<string> {
    if (this.connection === null) return "Microsoft SQL Server";
    try {
      const result = await this.connection.promises.query(
        "SELECT @@VERSION AS version",
      );
      const version = (
        result.results[0]?.[0] as { version?: string } | undefined
      )?.version;
      return version ? version.split("\n")[0]!.trim() : "Microsoft SQL Server";
    } catch {
      return "Microsoft SQL Server";
    }
  }
}

export const sqlServerInstance = INSTANCE;

function normalizeDbName(name?: string): string {
  if (name === undefined || name.trim().length === 0) return PRACTICE_DB;
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.length > 0 ? cleaned : PRACTICE_DB;
}
