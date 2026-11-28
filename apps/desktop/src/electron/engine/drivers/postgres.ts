import { Client, type ClientConfig } from "pg";
import { execFile } from "node:child_process";
import { createConnection } from "node:net";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { EngineDialect } from "../../../shared/engines";
import type {
  SqlResult,
  TableInfo,
} from "../../../shared/desktop-api";
import {
  ensureEngineInstanceDirs,
  getInstanceConfigDir,
  getInstanceDataDir,
  getInstanceLogsDir,
  getPacksDir,
} from "../paths";
import { getPackage, memoryProfile } from "../catalog";
import { findFreePort, supervisor } from "../supervisor";
import { retrieveSecret, storeSecret } from "../../secrets";
import { parseUseStatement } from "../../../shared/sql";
import { splitScript } from "../script-splitter";
import { formatSqlRow } from "../value-formatter";
import {
  findExecutable,
  generateSecret,
  packRoot,
  waitFor,
} from "../util";
import { emptyResult, type EngineDriver, type SqlOptions } from "./base";

const ADMIN_USER = "postgres";
const PRACTICE_USER = "practice_user";
const PRACTICE_DB = "practice";
const ADMIN_SECRET = "engine:postgres:admin";
const PRACTICE_SECRET = "engine:postgres:practice";
const DEFAULT_MAX_ROWS = 10000;

interface RuntimeConfig {
  port: number;
}

function readSecret(key: string): string {
  try {
    return retrieveSecret(key) ?? "";
  } catch {
    return "";
  }
}

export class PostgresDriver implements EngineDriver {
  readonly dialect: EngineDialect = "postgres";
  private admin: Client | null = null;
  private session: Client | null = null;
  private database = PRACTICE_DB;
  private serverPort = 5432;
  private adminPassword = "";
  private practicePassword = "";

  public get port(): number {
    return this.serverPort;
  }

  private paths(): {
    dataDir: string;
    configDir: string;
    logsDir: string;
    packDir: string;
  } {
    const version = getPackage("postgres")?.version ?? "18.7.0";
    ensureEngineInstanceDirs("postgres");
    return {
      dataDir: getInstanceDataDir("postgres"),
      configDir: getInstanceConfigDir("postgres"),
      logsDir: getInstanceLogsDir("postgres"),
      packDir: packRoot(getPacksDir("postgres", version)),
    };
  }

  private resolveBinary(name: string): string {
    const { packDir } = this.paths();
    const found = findExecutable(packDir, name);
    if (found === null) {
      throw new Error(
        `PostgreSQL package is incomplete: ${name} was not found. Repair the engine from Databases.`,
      );
    }
    return found;
  }

  private runBinary(
    name: string,
    args: string[],
    timeoutMs = 120000,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFile(
        this.resolveBinary(name),
        args,
        { windowsHide: true, timeout: timeoutMs, env: process.env },
        (error, stdout, stderr) => {
          if (error) {
            reject(
              new Error(
                `${name} failed: ${(stderr || stdout || error.message).trim()}`,
              ),
            );
            return;
          }
          resolve({ stdout, stderr });
        },
      );
    });
  }

  private runtimePath(): string {
    return join(this.paths().configDir, "runtime.json");
  }

  private readRuntime(): RuntimeConfig | null {
    try {
      const parsed = JSON.parse(
        readFileSync(this.runtimePath(), "utf8"),
      ) as RuntimeConfig;
      return typeof parsed.port === "number" ? parsed : null;
    } catch {
      return null;
    }
  }

  private writeRuntime(port: number): void {
    const { configDir } = this.paths();
    mkdirSync(configDir, { recursive: true, mode: 0o700 });
    writeFileSync(
      this.runtimePath(),
      `${JSON.stringify({ port }, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
  }

  private async initialize(): Promise<void> {
    const { dataDir, configDir } = this.paths();
    const initialized = existsSync(join(dataDir, "PG_VERSION"));

    if (initialized) {
      this.serverPort = this.readRuntime()?.port ?? 5432;
      this.adminPassword = readSecret(ADMIN_SECRET);
      this.practicePassword = readSecret(PRACTICE_SECRET);
      if (
        this.adminPassword.length === 0 ||
        this.practicePassword.length === 0
      ) {
        throw new Error(
          "PostgreSQL credentials for this instance are missing. Use Repair in Databases to re-initialize it.",
        );
      }
      return;
    }

    rmSync(dataDir, { recursive: true, force: true });
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.adminPassword = generateSecret();
    this.practicePassword = generateSecret();
    storeSecret(ADMIN_SECRET, this.adminPassword);
    storeSecret(PRACTICE_SECRET, this.practicePassword);

    const passwordFile = join(configDir, "initdb.pw");
    writeFileSync(passwordFile, this.adminPassword, {
      encoding: "utf8",
      mode: 0o600,
    });

    try {
      await this.runBinary(
        "initdb",
        [
          "-D",
          dataDir,
          "-U",
          ADMIN_USER,
          "-A",
          "scram-sha-256",
          "-E",
          "UTF8",
          "--locale=C",
          `--pwfile=${passwordFile}`,
        ],
        300000,
      );
    } finally {
      if (existsSync(passwordFile)) {
        try {
          unlinkSync(passwordFile);
        } catch {}
      }
    }

    this.serverPort = await findFreePort(5432);
    this.writeRuntime(this.serverPort);

    const profile = memoryProfile();
    const memory =
      profile === "low"
        ? [
            "shared_buffers = 32MB",
            "max_connections = 20",
            "work_mem = 4MB",
            "maintenance_work_mem = 32MB",
            "effective_cache_size = 256MB",
          ]
        : [
            "shared_buffers = 128MB",
            "max_connections = 50",
            "work_mem = 8MB",
            "maintenance_work_mem = 64MB",
            "effective_cache_size = 1GB",
          ];

    const settings = [
      "",
      "listen_addresses = '127.0.0.1'",
      `port = ${this.serverPort}`,
      ...(process.platform === "darwin" ? ["unix_socket_directories = ''"] : []),
      "logging_collector = off",
      "log_min_messages = warning",
      ...memory,
      "",
    ].join("\n");

    const configFile = join(dataDir, "postgresql.conf");
    const existing = existsSync(configFile)
      ? readFileSync(configFile, "utf8")
      : "";
    writeFileSync(configFile, `${existing}\n${settings}`, "utf8");
  }

  private async start(): Promise<void> {
    if (supervisor.isRunning("postgres")) return;
    const { dataDir, logsDir } = this.paths();
    supervisor.spawnEngineProcess({
      engineId: "postgres",
      executable: this.resolveBinary("postgres"),
      args: ["-D", dataDir, "-p", String(this.serverPort)],
      cwd: dataDir,
      port: this.serverPort,
      env: { PGDATA: dataDir },
    });

    const ready = await waitFor(() => this.ping(), 60, 500);
    if (!ready) {
      const logPath = join(logsDir, "engine.log");
      throw new Error(
        `PostgreSQL did not become ready on 127.0.0.1:${this.serverPort}. See ${logPath}.`,
      );
    }
  }

  private clientOptions(database: string): ClientConfig {
    return {
      host: "127.0.0.1",
      port: this.serverPort,
      database,
      ssl: false,
      connectionTimeoutMillis: 5000,
      application_name: "logixzen",
    };
  }

  private ping(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection({
        host: "127.0.0.1",
        port: this.serverPort,
      });
      const settle = (value: boolean): void => {
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(2000);
      socket.once("connect", () => settle(true));
      socket.once("timeout", () => settle(false));
      socket.once("error", () => settle(false));
    });
  }

  public async connect(): Promise<void> {
    await this.initialize();
    await this.start();

    this.admin = new Client({
      ...this.clientOptions("postgres"),
      user: ADMIN_USER,
      password: this.adminPassword,
    });
    await this.admin.connect();
    await this.ensurePracticeEnvironment();

    this.session = new Client({
      ...this.clientOptions(this.database),
      user: PRACTICE_USER,
      password: this.practicePassword,
    });
    await this.session.connect();
  }

  private async ensurePracticeEnvironment(): Promise<void> {
    if (this.admin === null) return;

    const role = await this.admin.query(
      "SELECT 1 FROM pg_roles WHERE rolname = $1",
      [PRACTICE_USER],
    );
    if (role.rows.length === 0) {
      await this.admin.query(
        `CREATE ROLE ${PRACTICE_USER} WITH LOGIN CREATEDB PASSWORD '${this.practicePassword}'`,
      );
    } else {
      await this.admin.query(
        `ALTER ROLE ${PRACTICE_USER} WITH PASSWORD '${this.practicePassword}'`,
      );
    }

    const database = await this.admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [this.database],
    );
    if (database.rows.length === 0) {
      await this.admin.query(
        `CREATE DATABASE "${this.database.replace(/"/g, '""')}" OWNER ${PRACTICE_USER}`,
      );
    }
  }

  public async disconnect(): Promise<void> {
    if (this.session !== null) {
      try {
        await this.session.end();
      } catch {}
      this.session = null;
    }
    if (this.admin !== null) {
      try {
        await this.admin.end();
      } catch {}
      this.admin = null;
    }

    const { dataDir } = this.paths();
    await supervisor.stopCurrent(async () => {
      await this.runBinary(
        "pg_ctl",
        ["-D", dataDir, "stop", "-m", "fast", "-w", "-t", "15"],
        20000,
      );
    });
  }

  public async execute(
    sql: string,
    options?: SqlOptions,
  ): Promise<SqlResult[]> {
    if (this.session === null) {
      throw new Error("PostgreSQL session is not open.");
    }
    return this.executeOnClient(this.session, sql, options, true);
  }

  private async executeOnClient(
    client: Client,
    sql: string,
    options?: SqlOptions,
    allowCancel = false,
  ): Promise<SqlResult[]> {
    const started = performance.now();
    const split = splitScript(sql, "postgres");
    if (split.error !== undefined) {
      return [emptyResult(0, started, split.error)];
    }

    const statements = split.statements.length > 0 ? split.statements : [sql];
    const timeoutMs = options?.timeoutMs ?? 0;
    const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;
    let timer: NodeJS.Timeout | null = null;
    if (timeoutMs > 0 && allowCancel) {
      timer = setTimeout(() => {
        void this.cancel();
      }, timeoutMs);
    }

    const results: SqlResult[] = [];
    let currentClient = client;

    try {
      for (const statement of statements) {
        const stmtStart = performance.now();
        const useTarget = allowCancel ? parseUseStatement(statement) : null;
        if (useTarget !== null) {
          try {
            await this.useDatabase(useTarget);
            if (this.session !== null) {
              currentClient = this.session;
            }
            results.push(
              emptyResult(
                results.length,
                stmtStart,
                undefined,
                `Switched database to "${useTarget}".`,
              ),
            );
          } catch (error) {
            results.push(
              emptyResult(
                results.length,
                stmtStart,
                error instanceof Error ? error.message : String(error),
              ),
            );
          }
          continue;
        }

        try {
          const response = await currentClient.query(statement);
          const elapsed = Math.round(performance.now() - stmtStart);
          const batch = Array.isArray(response) ? response : [response];
          for (const item of batch) {
            const columns = item.fields.map(
              (field: { name: string }) => field.name,
            );
            results.push({
              columns,
              rows: item.rows
                .slice(0, maxRows)
                .map((row: Record<string, unknown>) => formatSqlRow(row)),
              rowsAffected: item.rowCount ?? 0,
              executionTimeMs: elapsed,
              isSelect: columns.length > 0,
              statementIndex: results.length,
            });
          }
        } catch (error) {
          results.push(
            emptyResult(
              results.length,
              stmtStart,
              error instanceof Error ? error.message : String(error),
            ),
          );
        }
      }

      if (results.length === 0) {
        return [emptyResult(0, started, undefined, "Statement completed.")];
      }
      return results;
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  }

  public async isolatedRun(setupSql: string, sql: string): Promise<SqlResult[]> {
    if (this.admin === null) {
      throw new Error("PostgreSQL is not connected.");
    }
    const started = performance.now();
    const tempDb = `logixzen_iso_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    let tempClient: Client | null = null;
    try {
      await this.admin.query(
        `CREATE DATABASE "${tempDb}" OWNER ${PRACTICE_USER}`,
      );
      tempClient = new Client({
        ...this.clientOptions(tempDb),
        user: PRACTICE_USER,
        password: this.practicePassword,
      });
      await tempClient.connect();
      if (setupSql.trim().length > 0) {
        const setupResults = await this.executeOnClient(
          tempClient,
          setupSql,
          { maxRows: Number.MAX_SAFE_INTEGER },
          false,
        );
        const setupError = setupResults.find((item) => item.error !== undefined);
        if (setupError?.error) {
          return [emptyResult(0, started, setupError.error)];
        }
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
      if (tempClient !== null) {
        try {
          await tempClient.end();
        } catch {}
      }
      try {
        await this.admin.query(`DROP DATABASE IF EXISTS "${tempDb}" WITH (FORCE)`);
      } catch {}
    }
  }

  public async cancel(): Promise<void> {
    if (this.admin === null || this.session === null) return;
    const backendPid = (this.session as unknown as { processID?: number })
      .processID;
    if (typeof backendPid === "number" && backendPid > 0) {
      try {
        await this.admin.query("SELECT pg_cancel_backend($1)", [backendPid]);
      } catch {}
    }
  }

  public async getSchema(): Promise<TableInfo[]> {
    if (this.session === null) return [];

    const tables = await this.session.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );

    const schema: TableInfo[] = [];

    for (const table of tables.rows as Array<{ table_name: string }>) {
      const name = table.table_name;
      const quoted = `"${name.replace(/"/g, '""')}"`;

      const columns = await this.session.query(
        `SELECT ordinal_position AS cid, column_name AS name, data_type AS type,
                is_nullable, column_default AS default_value
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [name],
      );

      const primaryKey = await this.session.query(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema = 'public'
           AND tc.table_name = $1`,
        [name],
      );

      const primaryColumns = new Set(
        primaryKey.rows.map((row) => String(row.column_name)),
      );

      const mapped = columns.rows.map((column) => ({
        cid: Number(column.cid),
        name: String(column.name),
        type: String(column.type),
        notNull: column.is_nullable === "NO",
        defaultValue: column.default_value,
        primaryKey: primaryColumns.has(String(column.name)),
      }));

      const foreignKeys = await this.session.query(
        `SELECT kcu.column_name AS from_column,
                ccu.table_name AS target_table,
                ccu.column_name AS target_column
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = 'public'
           AND tc.table_name = $1`,
        [name],
      );

      let sampleRows: Record<string, unknown>[] = [];
      try {
        const sample = await this.session.query(
          `SELECT * FROM ${quoted} LIMIT 5`,
        );
        sampleRows = sample.rows.map((row) => formatSqlRow(row));
      } catch {}

      const primary = mapped
        .filter((column) => column.primaryKey)
        .map((column) => column.name);

      schema.push({
        name,
        columns: mapped,
        sampleRows,
        primaryKey: primary.length > 0 ? primary : undefined,
        foreignKeys: foreignRows(foreignKeys.rows),
      });
    }

    return schema;
  }

  public async listDatabases(): Promise<string[]> {
    if (this.session === null) return [this.database];
    try {
      const result = await this.session.query(
        "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
      );
      return result.rows.map((row) => String(row.datname));
    } catch {
      return [this.database];
    }
  }

  public async useDatabase(name: string): Promise<void> {
    if (this.database === name && this.session !== null) return;
    if (this.session === null) {
      this.database = name;
      return;
    }
    const nextClient = new Client({
      ...this.clientOptions(name),
      user: PRACTICE_USER,
      password: this.practicePassword,
    });
    await nextClient.connect();
    const previousClient = this.session;
    this.session = nextClient;
    this.database = name;
    try {
      await previousClient.end();
    } catch {}
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
    if (reset && dbName !== "postgres") {
      if (this.database === dbName && this.session !== null) {
        await this.useDatabase("postgres");
      }
      await this.admin!.query(
        `DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`,
      );
    }
    const exists = await this.admin!.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (exists.rows.length === 0) {
      await this.admin!.query(
        `CREATE DATABASE "${dbName}" OWNER ${PRACTICE_USER}`,
      );
    }
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
    if (this.session === null) return this.ping();
    try {
      const result = await this.session.query("SELECT 1 AS ok");
      return result.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  public async getServerVersion(): Promise<string> {
    if (this.session === null) return "PostgreSQL";
    try {
      const result = await this.session.query("SELECT version() AS version");
      return String(result.rows[0]?.version ?? "PostgreSQL");
    } catch {
      return "PostgreSQL";
    }
  }
}

function foreignRows(
  rows: Array<Record<string, unknown>>,
): TableInfo["foreignKeys"] {
  return rows.map((row) => ({
    from: String(row.from_column),
    table: String(row.target_table),
    to: String(row.target_column),
  }));
}

function normalizeDbName(name?: string): string {
  if (name === undefined || name.trim().length === 0) return PRACTICE_DB;
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.length > 0 ? cleaned : PRACTICE_DB;
}
