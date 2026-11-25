import { execFile, execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { EngineDialect, EngineOptionId } from "../../shared/engines";
import type {
  SqlResult,
  TableInfo,
} from "../../shared/desktop-api";
import { loadInstallState } from "../state/store";
import { retrieveSecret } from "../secrets";
import {
  artifactFor,
  getCatalogEntry,
  getPackage,
  type EngineKind,
} from "./catalog";
import {
  ensureEngineInstanceDirs,
  getInstanceDir,
  getPacksDir,
} from "./paths";
import { recoverCrashLeftovers, supervisor } from "./supervisor";
import {
  extractArchive,
  fetchAndVerifyArtifact,
  type DownloadProgress,
} from "./downloader";
import type { EngineDriver } from "./drivers/base";
import { SqliteDriver, isolatedSqliteRun } from "./drivers/sqlite";
import { PostgresDriver } from "./drivers/postgres";
import { MysqlDriver } from "./drivers/mysql";
import { SqlServerDriver } from "./drivers/sqlserver";
import { createRemoteDriver } from "./drivers/remote";
import { emptyResult } from "./drivers/base";

const PRACTICE_DB = "practice";

export type InstallPhase =
  | "detect"
  | "download"
  | "verify"
  | "extract"
  | "package";

export interface InstallHooks {
  signal?: AbortSignal;
  onPhase?: (phase: InstallPhase) => void;
  onProgress?: (progress: DownloadProgress) => void;
}

interface MsiSpec {
  path: string;
  properties: string[];
}

function windowsComponentInstalled(): boolean {
  if (process.platform !== "win32") return false;
  const drivers = ["18", "17", "13", "11"];
  const odbc = drivers.some((version) => {
    try {
      execFileSync(
        "reg",
        [
          "query",
          `HKLM\\SOFTWARE\\ODBC\\ODBCINST.INI\\ODBC Driver ${version} for SQL Server`,
          "/ve",
        ],
        { stdio: "ignore" },
      );
      return true;
    } catch {
      return false;
    }
  });
  if (!odbc) return false;
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  return ["170", "160", "150", "140", "130", "120"].some((version) =>
    existsSync(
      join(
        programFiles,
        "Microsoft SQL Server",
        version,
        "Tools",
        "Binn",
        "SqlLocalDB.exe",
      ),
    ),
  );
}

function runElevated(msiFiles: MsiSpec[]): Promise<void> {
  const installs = msiFiles
    .map((spec) => {
      const args = [
        "/i",
        `"${spec.path}"`,
        "/qn",
        "/norestart",
        ...spec.properties,
      ].join(" ");
      return `$p = Start-Process -FilePath msiexec.exe -ArgumentList ${quotePowerShell(args)} -Wait -PassThru; if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010 -and $p.ExitCode -ne 1638) { exit $p.ExitCode }`;
    })
    .join("\n");
  const scriptPath = join(
    tmpdir(),
    `logixzen-install-${Date.now().toString(36)}.ps1`,
  );
  writeFileSync(scriptPath, installs, "utf8");

  const launcher = [
    "$ErrorActionPreference = 'Stop'",
    "try {",
    `  $p = Start-Process -FilePath powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',${quotePowerShell(
      scriptPath,
    )})`,
    "  exit $p.ExitCode",
    "} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1223 }",
  ].join("\n");

  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", launcher],
      { windowsHide: true, timeout: 900000 },
      (error, _stdout, stderr) => {
        try {
          rmSync(scriptPath, { force: true });
        } catch {}
        if (!error) {
          resolve();
          return;
        }
        const code = (error as { code?: number }).code;
        if (code === 1223 || /cancel/i.test(stderr)) {
          reject(
            new Error(
              "Administrator permission was declined. Approve the Windows prompt to install SQL Server.",
            ),
          );
          return;
        }
        reject(
          new Error(
            `SQL Server setup failed with exit code ${code ?? 1}: ${stderr.trim() || error.message}`,
          ),
        );
      },
    );
  });
}

function quotePowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

class EngineService {
  private driver: EngineDriver | null = null;
  private activeId: EngineOptionId | null = null;

  public async initialize(): Promise<void> {
    await recoverCrashLeftovers();
    try {
      const loaded = await loadInstallState();
      this.activeId = loaded.state.activeOptionId ?? null;
    } catch {
      this.activeId = null;
    }
  }

  public activeEngineId(): EngineOptionId | null {
    return this.activeId;
  }

  public async install(
    id: EngineOptionId,
    hooks?: InstallHooks,
  ): Promise<void> {
    const entry = getCatalogEntry(id);
    const pkg = getPackage(id);
    if (entry === undefined || pkg === undefined) {
      throw new Error(`Unknown engine "${id}".`);
    }
    if (pkg.kind === "container") {
      throw new Error(
        `${pkg.name} is provisioned as a container from Databases.`,
      );
    }

    hooks?.onPhase?.("detect");
    ensureEngineInstanceDirs(id);

    if (pkg.kind === "embedded") {
      return;
    }

    const resolved = artifactFor(id);
    if (resolved === null) {
      throw new Error(
        `No ${pkg.name} package is available for this operating system.`,
      );
    }

    const packDir = getPacksDir(id, pkg.version);
    const marker = join(packDir, ".logixzen-ready");
    if (resolved.artifact.format !== "msi" && existsSync(marker)) return;

    const { artifact } = resolved;
    if (artifact.format === "msi" && windowsComponentInstalled()) return;
    hooks?.onPhase?.("download");
    const download = await fetchAndVerifyArtifact(
      id,
      artifact,
      hooks?.onProgress,
      hooks?.signal,
    );
    hooks?.onPhase?.("verify");

    if (artifact.format === "msi") {
      hooks?.onPhase?.("package");
      const companions = await Promise.all(
        (pkg.companions ?? []).map((companion) =>
          fetchAndVerifyArtifact(id, companion, undefined, hooks?.signal),
        ),
      );
      const specs: MsiSpec[] = [
        {
          path: download,
          properties: ["IACCEPTSQLLOCALDBLICENSETERMS=YES"],
        },
        ...companions.map((path) => ({
          path,
          properties: ["IACCEPTMSODBCSQLLICENSETERMS=YES"],
        })),
      ];
      await runElevated(specs);
      return;
    }

    hooks?.onPhase?.("extract");
    await extractArchive(download, packDir);
    if (!existsSync(packDir) || readdirSync(packDir).length === 0) {
      throw new Error(
        `The ${pkg.name} package was downloaded but could not be unpacked. Check free disk space and retry.`,
      );
    }
    writeFileSync(marker, pkg.version, "utf8");
  }

  public async select(id: EngineOptionId): Promise<void> {
    if (this.activeId === id && this.driver !== null) {
      return;
    }
    await this.stop();

    const entry = getCatalogEntry(id);
    const pkg = getPackage(id);
    if (entry === undefined || pkg === undefined) {
      throw new Error(`Unknown engine "${id}".`);
    }

    const driver = await this.createDriver(pkg.kind, id, pkg.dialect);
    try {
      await driver.connect();
    } catch (error) {
      try {
        await driver.disconnect();
      } catch {}
      throw error;
    }

    this.driver = driver;
    this.activeId = id;
  }

  private async createDriver(
    kind: EngineKind,
    id: EngineOptionId,
    dialect: EngineDialect,
  ): Promise<EngineDriver> {
    if (kind === "embedded") {
      return new SqliteDriver();
    }
    if (kind === "container") {
      return this.createContainerDriver(id, dialect);
    }
    if (id === "postgres") return new PostgresDriver();
    if (id === "mysql") return new MysqlDriver();
    if (id === "sqlserver") return new SqlServerDriver();
    throw new Error(`No driver is registered for "${id}".`);
  }

  private async createContainerDriver(
    id: EngineOptionId,
    dialect: EngineDialect,
  ): Promise<EngineDriver> {
    if (dialect !== "postgres" && dialect !== "mysql" && dialect !== "tsql") {
      throw new Error(`Container engine "${id}" uses an unsupported dialect.`);
    }
    const loaded = await loadInstallState();
    const record = loaded.state.installations.find(
      (item) => item.optionId === id,
    );
    if (
      record === undefined ||
      record.status !== "ready" ||
      record.port === undefined
    ) {
      throw new Error(
        `${getCatalogEntry(id)?.displayName ?? id} is not running. Start it from Databases.`,
      );
    }
    let password = "";
    if (record.secretRef !== undefined) {
      try {
        password = retrieveSecret(record.secretRef) ?? "";
      } catch {}
    }
    return createRemoteDriver({
      dialect,
      port: record.port,
      user: dialect === "tsql" ? "logixzen_user" : "logixzen",
      password,
    });
  }

  public async stop(): Promise<void> {
    if (this.driver === null) {
      await supervisor.stopCurrent();
      return;
    }
    const driver = this.driver;
    this.driver = null;
    try {
      await driver.disconnect();
    } finally {
      await supervisor.stopCurrent();
    }
  }

  public async detach(): Promise<void> {
    await this.stop();
    this.activeId = null;
  }

  private async ensureDriver(): Promise<EngineDriver> {
    if (this.driver !== null) {
      return this.driver;
    }
    if (this.activeId === null) {
      const loaded = await loadInstallState();
      this.activeId = loaded.state.activeOptionId ?? null;
    }
    if (this.activeId === null) {
      throw new Error(
        "No database engine is selected. Install one from Setup.",
      );
    }
    await this.select(this.activeId);
    if (this.driver === null) {
      throw new Error("The selected engine could not be started.");
    }
    return this.driver;
  }

  public async runSql(sql: string): Promise<SqlResult[]> {
    const started = performance.now();
    try {
      const driver = await this.ensureDriver();
      return await driver.execute(sql, { maxRows: 10000, timeoutMs: 30000 });
    } catch (error) {
      return [
        emptyResult(
          0,
          started,
          error instanceof Error ? error.message : String(error),
        ),
      ];
    }
  }

  public async cancel(): Promise<void> {
    await this.driver?.cancel();
  }

  public async execute(sql: string): Promise<SqlResult[]> {
    const driver = await this.ensureDriver();
    return driver.execute(sql, { maxRows: 10000, timeoutMs: 60000 });
  }

  public async getSchema(): Promise<TableInfo[]> {
    const driver = await this.ensureDriver();
    return driver.getSchema();
  }

  public async listDatabases(): Promise<string[]> {
    const driver = await this.ensureDriver();
    return driver.listDatabases();
  }

  public async useDatabase(name: string): Promise<void> {
    const driver = await this.ensureDriver();
    await driver.useDatabase(name);
  }

  public async currentDatabase(): Promise<string | null> {
    if (this.driver === null) {
      if (this.activeId === null) return null;
      return this.activeId === "sqlite" ? PRACTICE_DB : null;
    }
    return this.driver.currentDatabase();
  }

  public async initializeDatabase(
    setupSql?: string,
    name?: string,
    reset = false,
  ): Promise<void> {
    const driver = await this.ensureDriver();
    if (driver.initializeDatabase !== undefined) {
      await driver.initializeDatabase(setupSql, name, reset);
      return;
    }
    if (name !== undefined && name.length > 0) {
      await driver.useDatabase(name);
    }
    if (setupSql !== undefined && setupSql.trim().length > 0) {
      await driver.execute(setupSql);
    }
  }

  public async verify(id: EngineOptionId): Promise<void> {
    await this.select(id);
    const driver = await this.ensureDriver();
    const ok = await driver.healthCheck();
    if (!ok) {
      throw new Error(
        `${getCatalogEntry(id)?.displayName ?? id} did not answer a health check.`,
      );
    }
  }

  public async activePort(): Promise<number | null> {
    return this.driver?.port ?? null;
  }

  public async removePack(id: EngineOptionId): Promise<void> {
    const pkg = getPackage(id);
    if (pkg === undefined) return;
    const packDir = getPacksDir(id, pkg.version);
    if (existsSync(packDir)) {
      rmSync(packDir, { recursive: true, force: true });
    }
  }

  public async removeInstance(id: EngineOptionId): Promise<void> {
    const instanceDir = getInstanceDir(id);
    if (existsSync(instanceDir)) {
      rmSync(instanceDir, { recursive: true, force: true });
    }
  }

  public async runIsolatedSql(setupSql: string, sql: string): Promise<SqlResult[]> {
    const started = performance.now();
    try {
      const driver = await this.ensureDriver();
      if (driver instanceof SqliteDriver) {
        return isolatedSqliteRun(setupSql, sql);
      }
      if (driver.isolatedRun !== undefined) {
        return await driver.isolatedRun(setupSql, sql);
      }
      return [
        emptyResult(
          0,
          started,
          `Isolated execution is not supported for ${driver.dialect}.`,
        ),
      ];
    } catch (error) {
      return [
        emptyResult(
          0,
          started,
          error instanceof Error ? error.message : String(error),
        ),
      ];
    }
  }
}

export const engineService = new EngineService();
