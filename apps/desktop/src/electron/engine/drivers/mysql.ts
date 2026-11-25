import mysql, {
  type Connection,
  type ConnectionOptions,
  type FieldPacket,
  type RowDataPacket,
} from "mysql2/promise";
import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { EngineDialect, EngineOptionId } from "../../../shared/engines";
import type {
  SqlResult,
  TableInfo,
} from "../../../shared/desktop-api";
import {
  ensureEngineInstanceDirs,
  getInstanceConfigDir,
  getInstanceDataDir,
  getPacksDir,
} from "../paths";
import { getPackage, memoryProfile } from "../catalog";
import { findFreePort, supervisor } from "../supervisor";
import { retrieveSecret, storeSecret } from "../../secrets";
import { formatSqlRow } from "../value-formatter";
import {
  findExecutable,
  generateSecret,
  packRoot,
  waitFor,
} from "../util";
import { emptyResult, type EngineDriver, type SqlOptions } from "./base";

const PRACTICE_USER = "practice_user";
const PRACTICE_DB = "practice";
const DEFAULT_MAX_ROWS = 10000;

interface FamilyConfig {
  id: EngineOptionId;
  dialect: EngineDialect;
  label: string;
  defaultPort: number;
  serverBinary: string;
  initBinary: string;
  initArgs: (dataDir: string, baseDir: string) => string[];
  configSection: string;
  supportsXProtocol: boolean;
  collation: string;
}

const MYSQL_CONFIG: FamilyConfig = {
  id: "mysql",
  dialect: "mysql",
  label: "MySQL",
  defaultPort: 3306,
  serverBinary: "mysqld",
  initBinary: "mysqld",
  initArgs: (dataDir, baseDir) => [
    "--initialize-insecure",
    `--datadir=${dataDir}`,
    `--basedir=${baseDir}`,
  ],
  configSection: "mysqld",
  supportsXProtocol: true,
  collation: "utf8mb4_0900_ai_ci",
};

interface MysqlRuntime {
  port: number;
}

class MysqlFamilyDriver implements EngineDriver {
  readonly dialect: EngineDialect;
  private admin: Connection | null = null;
  private session: Connection | null = null;
  private database = PRACTICE_DB;
  private serverPort: number;
  private rootPassword = "";
  private practicePassword = "";

  constructor(private readonly config: FamilyConfig) {
    this.dialect = config.dialect;
    this.serverPort = config.defaultPort;
  }

  public get port(): number {
    return this.serverPort;
  }

  private paths(): {
    dataDir: string;
    configDir: string;
    packDir: string;
    configFile: string;
  } {
    const version = getPackage(this.config.id)?.version ?? "1";
    ensureEngineInstanceDirs(this.config.id);
    const configDir = getInstanceConfigDir(this.config.id);
    return {
      dataDir: getInstanceDataDir(this.config.id),
      configDir,
      packDir: packRoot(getPacksDir(this.config.id, version)),
      configFile: join(
        configDir,
        process.platform === "win32" ? "my.ini" : "my.cnf",
      ),
    };
  }

  private resolveBinary(name: string): string {
    const found = findExecutable(this.paths().packDir, name);
    if (found === null) {
      throw new Error(
        `${this.config.label} package is incomplete: ${name} was not found. Repair the engine from Databases.`,
      );
    }
    return found;
  }

  private runBinary(
    name: string,
    args: string[],
    timeoutMs = 300000,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFile(
        this.resolveBinary(name),
        args,
        {
          windowsHide: true,
          timeout: timeoutMs,
          cwd: this.paths().packDir,
          env: process.env,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(
              new Error(
                `${this.config.label} ${name} failed: ${(stderr || stdout || error.message).trim()}`,
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

  private readRuntime(): MysqlRuntime | null {
    try {
      const raw = JSON.parse(
        readFileSync(this.runtimePath(), "utf8"),
      ) as MysqlRuntime;
      return typeof raw.port === "number" ? raw : null;
    } catch {
      return null;
    }
  }

  private writeRuntime(): void {
    mkdirSync(this.paths().configDir, { recursive: true, mode: 0o700 });
    writeFileSync(
      this.runtimePath(),
      `${JSON.stringify({ port: this.serverPort }, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
  }

  private secretKey(kind: "root" | "practice"): string {
    return `engine:${this.config.id}:${kind}`;
  }

  private readSecret(kind: "root" | "practice"): string {
    try {
      return retrieveSecret(this.secretKey(kind)) ?? "";
    } catch {
      return "";
    }
  }

  private async initialize(): Promise<void> {
    const { dataDir, packDir, configFile } = this.paths();
    const initialized = existsSync(join(dataDir, "mysql"));

    if (initialized) {
      this.serverPort = this.readRuntime()?.port ?? this.config.defaultPort;
      this.rootPassword = this.readSecret("root");
      this.practicePassword = this.readSecret("practice");
      if (this.practicePassword.length === 0) {
        throw new Error(
          `${this.config.label} credentials for this instance are missing. Use Repair in Databases to re-initialize it.`,
        );
      }
      return;
    }

    rmSync(dataDir, { recursive: true, force: true });
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.rootPassword = generateSecret();
    this.practicePassword = generateSecret();
    storeSecret(this.secretKey("root"), this.rootPassword);
    storeSecret(this.secretKey("practice"), this.practicePassword);

    await this.runBinary(
      this.config.initBinary,
      this.config.initArgs(dataDir, packDir),
    );

    this.serverPort = await findFreePort(this.config.defaultPort);
    this.writeRuntime();

    const profile = memoryProfile();
    const memory =
      profile === "low"
        ? [
            "innodb_buffer_pool_size=64M",
            "max_connections=20",
            "tmp_table_size=16M",
          ]
        : [
            "innodb_buffer_pool_size=256M",
            "max_connections=50",
            "tmp_table_size=32M",
          ];

    const settings = [
      `[${this.config.configSection}]`,
      `basedir=${packDir.replace(/\\/g, "/")}`,
      `datadir=${dataDir.replace(/\\/g, "/")}`,
      "bind-address=127.0.0.1",
      `port=${this.serverPort}`,
      ...(this.config.supportsXProtocol ? ["mysqlx=0"] : []),
      "performance_schema=OFF",
      "skip-log-bin",
      "secure_file_priv=NULL",
      "local_infile=0",
      "character-set-server=utf8mb4",
      `collation-server=${this.config.collation}`,
      ...memory,
      "",
    ].join("\n");

    writeFileSync(configFile, settings, "utf8");
  }

  private async start(): Promise<void> {
    if (supervisor.isRunning(this.config.id)) return;

    const { configFile, packDir } = this.paths();
    supervisor.spawnEngineProcess({
      engineId: this.config.id,
      executable: this.resolveBinary(this.config.serverBinary),
      args: [
        `--defaults-file=${configFile}`,
        ...(process.platform === "win32" ? ["--console"] : []),
      ],
      cwd: packDir,
      port: this.serverPort,
      env: { MYSQL_HOME: packDir },
    });

    const ready = await waitFor(
      async () =>
        (await this.canConnect(this.rootPassword)) ||
        (await this.canConnect("")),
      90,
      500,
    );
    if (!ready) {
      throw new Error(
        `${this.config.label} did not become ready on 127.0.0.1:${this.serverPort}. Check the engine log.`,
      );
    }

    if (!(await this.canConnect(this.rootPassword))) {
      const bootstrap = await this.connectAsRoot("");
      await bootstrap.query(
        `ALTER USER 'root'@'localhost' IDENTIFIED BY '${this.rootPassword}'`,
      );
      await bootstrap.query(
        `CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '${this.rootPassword}'`,
      );
      await bootstrap.query(
        `GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION`,
      );
      await bootstrap.query("FLUSH PRIVILEGES");
      await bootstrap.end();
    }
  }

  private async canConnect(password: string): Promise<boolean> {
    try {
      const connection = await mysql.createConnection(
        this.connectionOptions("root", password, "mysql"),
      );
      await connection.query("SELECT 1");
      await connection.end();
      return true;
    } catch {
      return false;
    }
  }

  private connectionOptions(
    user: string,
    password: string,
    database?: string,
  ): ConnectionOptions {
    return {
      host: "127.0.0.1",
      port: this.serverPort,
      user,
      password,
      database,
      connectTimeout: 5000,
      multipleStatements: true,
    };
  }

  private connectAsRoot(password: string): Promise<Connection> {
    return mysql.createConnection(this.connectionOptions("root", password));
  }

  public async connect(): Promise<void> {
    await this.initialize();
    await this.start();

    this.admin = await this.connectAsRoot(this.rootPassword);
    await this.ensurePracticeEnvironment();

    this.session = await mysql.createConnection(
      this.connectionOptions(PRACTICE_USER, this.practicePassword, this.database),
    );
  }

  private async ensurePracticeEnvironment(): Promise<void> {
    if (this.admin === null) return;
    await this.admin.query(`CREATE DATABASE IF NOT EXISTS \`${PRACTICE_DB}\``);
    for (const host of ["127.0.0.1", "localhost"]) {
      await this.admin.query(
        `CREATE USER IF NOT EXISTS '${PRACTICE_USER}'@'${host}' IDENTIFIED BY '${this.practicePassword}'`,
      );
      await this.admin.query(
        `ALTER USER '${PRACTICE_USER}'@'${host}' IDENTIFIED BY '${this.practicePassword}'`,
      );
      await this.admin.query(
        `GRANT ALL PRIVILEGES ON \`${PRACTICE_DB}\`.* TO '${PRACTICE_USER}'@'${host}'`,
      );
    }
    await this.admin.query("FLUSH PRIVILEGES");
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
        await this.admin.query("SHUTDOWN");
      } catch {}
      try {
        await this.admin.end();
      } catch {}
      this.admin = null;
    }
    await waitFor(() => Promise.resolve(!supervisor.isRunning(this.config.id)), 20, 250);
    await supervisor.stopCurrent();
  }

  public async execute(
    sql: string,
    options?: SqlOptions,
  ): Promise<SqlResult[]> {
    if (this.session === null) {
      throw new Error(`${this.config.label} session is not open.`);
    }
    return this.executeOnConnection(this.session, sql, options, true);
  }

  private async executeOnConnection(
    connection: Connection,
    sql: string,
    options?: SqlOptions,
    allowCancel = false,
  ): Promise<SqlResult[]> {
    const started = performance.now();
    const timeoutMs = options?.timeoutMs ?? 0;
    let timer: NodeJS.Timeout | null = null;
    if (timeoutMs > 0 && allowCancel) {
      timer = setTimeout(() => {
        void this.cancel();
      }, timeoutMs);
    }

    try {
      const [rawResults, rawFields] = await connection.query(sql);
      const elapsed = Math.round(performance.now() - started);
      const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;

      const isMulti =
        Array.isArray(rawResults) &&
        Array.isArray(rawFields) &&
        rawFields.some((f) => Array.isArray(f) || f === undefined);
      const resultSets = isMulti ? (rawResults as unknown[]) : [rawResults];
      const fieldSets = (
        isMulti ? rawFields : [rawFields]
      ) as Array<FieldPacket[] | undefined>;

      if (resultSets.length === 0) {
        return [emptyResult(0, started, undefined, "Statement completed.")];
      }

      return resultSets.map((item, index) => {
        if (Array.isArray(item)) {
          const rows = item as RowDataPacket[];
          const columns = (fieldSets[index] ?? []).map((field) => field.name);
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
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  }

  public async isolatedRun(setupSql: string, sql: string): Promise<SqlResult[]> {
    if (this.admin === null) {
      throw new Error(`${this.config.label} is not connected.`);
    }
    const started = performance.now();
    const tempDb = `logixzen_iso_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    let tempConn: Connection | null = null;
    try {
      await this.admin.query(`CREATE DATABASE \`${tempDb}\``);
      tempConn = await mysql.createConnection(
        this.connectionOptions("root", this.rootPassword, tempDb),
      );
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
      if (tempConn !== null) {
        try {
          await tempConn.end();
        } catch {}
      }
      try {
        await this.admin.query(`DROP DATABASE IF EXISTS \`${tempDb}\``);
      } catch {}
    }
  }

  public async cancel(): Promise<void> {
    if (this.admin === null || this.session === null) return;
    const threadId = this.session.threadId;
    if (typeof threadId === "number" && threadId > 0) {
      try {
        await this.admin.query(`KILL QUERY ${threadId}`);
      } catch {}
    }
  }

  public async getSchema(): Promise<TableInfo[]> {
    if (this.session === null) return [];

    const [tables] = await this.session.query<RowDataPacket[]>(
      `SELECT table_name AS table_name FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [this.database],
    );

    const schema: TableInfo[] = [];

    for (const table of tables) {
      const name = String(table.table_name);
      const [columns] = await this.session.query<RowDataPacket[]>(
        `SELECT ordinal_position AS cid, column_name AS name, column_type AS type,
                is_nullable AS is_nullable, column_default AS default_value, column_key AS key_type
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ordinal_position`,
        [this.database, name],
      );

      const mapped = columns.map((column) => ({
        cid: Number(column.cid),
        name: String(column.name),
        type: String(column.type),
        notNull: column.is_nullable === "NO",
        defaultValue: column.default_value,
        primaryKey: column.key_type === "PRI",
      }));

      const [keyRows] = await this.session.query<RowDataPacket[]>(
        `SELECT column_name AS from_column,
                referenced_table_name AS target_table,
                referenced_column_name AS target_column
         FROM information_schema.key_column_usage
         WHERE table_schema = ? AND table_name = ?
           AND referenced_table_name IS NOT NULL`,
        [this.database, name],
      );

      let sampleRows: Record<string, unknown>[] = [];
      try {
        const [sample] = await this.session.query<RowDataPacket[]>(
          `SELECT * FROM \`${name.replace(/`/g, "``")}\` LIMIT 5`,
        );
        sampleRows = sample.map((row) =>
          formatSqlRow(row as Record<string, unknown>),
        );
      } catch {}

      const primary = mapped
        .filter((column) => column.primaryKey)
        .map((column) => column.name);

      schema.push({
        name,
        columns: mapped,
        sampleRows,
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
    if (this.session === null) return [this.database];
    try {
      const [rows] = await this.session.query<RowDataPacket[]>("SHOW DATABASES");
      const internal = new Set([
        "information_schema",
        "performance_schema",
        "mysql",
        "sys",
      ]);
      return rows
        .map((row) => String(Object.values(row)[0]))
        .filter((name) => !internal.has(name.toLowerCase()));
    } catch {
      return [this.database];
    }
  }

  public async useDatabase(name: string): Promise<void> {
    if (this.session !== null) {
      await this.session.query(`USE \`${name.replace(/`/g, "``")}\``);
    }
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
    if (reset) {
      await this.admin!.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    }
    await this.admin!.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    for (const host of ["127.0.0.1", "localhost"]) {
      await this.admin!.query(
        `GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${PRACTICE_USER}'@'${host}'`,
      );
    }
    await this.admin!.query("FLUSH PRIVILEGES");
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
    if (this.session === null) return this.canConnect(this.rootPassword);
    try {
      const [rows] = await this.session.query<RowDataPacket[]>(
        "SELECT 1 AS ok",
      );
      return (rows[0] as { ok?: number } | undefined)?.ok === 1;
    } catch {
      return false;
    }
  }

  public async getServerVersion(): Promise<string> {
    if (this.session === null) return this.config.label;
    try {
      const [rows] = await this.session.query<RowDataPacket[]>(
        "SELECT VERSION() AS version",
      );
      const version = (rows[0] as { version?: string } | undefined)?.version;
      return version ? `${this.config.label} ${version}` : this.config.label;
    } catch {
      return this.config.label;
    }
  }
}

export class MysqlDriver extends MysqlFamilyDriver {
  constructor() {
    super(MYSQL_CONFIG);
  }
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
