import type { EngineOptionId } from "../../shared/engines";
import { ENGINE_CATALOG } from "../../shared/engine-catalog";
import type { SqlResult, TableInfo } from "../../shared/desktop-api";
import { retrieveSecret } from "../secrets";
import { loadInstallState, mutateInstallState } from "../state/store";
import { writeLog } from "../service/logger";
import type { DatabaseDriver } from "./drivers/driver";
import { SqliteDriver } from "./drivers/sqlite-driver";
import { PostgresDriver } from "./drivers/postgres-driver";
import { MysqlDriver } from "./drivers/mysql-driver";
import { TdsDriver } from "./drivers/tds-driver";

const IDLE_TIMEOUT_MS = 300000;

class ConnectionRegistry {
  private activeOptionId: EngineOptionId = "sqlite";
  private activeDriver: DatabaseDriver | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  private resetIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.idleTimer = setTimeout(() => {
      void this.disposeIdle();
    }, IDLE_TIMEOUT_MS);
  }

  private async disposeIdle(): Promise<void> {
    if (this.activeDriver && this.activeOptionId !== "sqlite") {
      writeLog("info", `Disposing idle connection for ${this.activeOptionId}`);
      await this.activeDriver.disconnect();
      this.activeDriver = null;
    }
  }

  public async initFromState(): Promise<void> {
    if (this.initialized) return;
    try {
      const loaded = await loadInstallState();
      if (loaded.state.activeOptionId) {
        this.activeOptionId = loaded.state.activeOptionId;
      }
    } catch {
      this.activeOptionId = "sqlite";
    }
    this.initialized = true;
  }

  public getActiveOptionId(): EngineOptionId {
    return this.activeOptionId;
  }

  public async setActiveEngine(optionId: EngineOptionId): Promise<void> {
    if (this.activeOptionId === optionId && this.activeDriver !== null) {
      return;
    }
    if (this.activeDriver) {
      await this.activeDriver.disconnect();
      this.activeDriver = null;
    }
    this.activeOptionId = optionId;
    await mutateInstallState((state) => ({
      ...state,
      activeOptionId: optionId,
    }));
    writeLog("info", `Active database engine set to: ${optionId}`);
  }

  private async createDriverFor(
    optionId: EngineOptionId,
  ): Promise<DatabaseDriver> {
    if (optionId === "sqlite") {
      return new SqliteDriver();
    }

    const loaded = await loadInstallState();
    const record = loaded.state.installations.find(
      (item) => item.optionId === optionId,
    );
    if (!record || record.status !== "ready") {
      const entry = ENGINE_CATALOG.find((e) => e.id === optionId);
      const name = entry?.displayName ?? optionId;
      throw new Error(
        `Engine "${name}" is not ready (status: ${record?.status ?? "not-installed"}). Start or configure the engine first.`,
      );
    }

    let password = "";
    if (record.secretRef) {
      try {
        password = (await retrieveSecret(record.secretRef)) ?? "";
      } catch {
        password = "";
      }
    }

    if (optionId === "postgres-container") {
      return new PostgresDriver({
        host: "127.0.0.1",
        port: record.port ?? 5432,
        database: "LogixZenPractice",
        user: "logixzen",
        password,
      });
    }

    if (optionId === "mysql-container") {
      return new MysqlDriver({
        host: "127.0.0.1",
        port: record.port ?? 3306,
        database: "LogixZenPractice",
        user: "logixzen",
        password,
      });
    }

    return new TdsDriver({
      server: "127.0.0.1",
      port: record.port ?? 1433,
      database: "LogixZenPractice",
      user: "logixzen_user",
      password,
    });
  }

  public async getDriver(): Promise<DatabaseDriver> {
    await this.initFromState();
    this.resetIdleTimer();

    if (this.activeDriver) {
      return this.activeDriver;
    }

    const driver = await this.createDriverFor(this.activeOptionId);
    await driver.connect();
    this.activeDriver = driver;
    return driver;
  }

  public async getDriverFor(optionId: EngineOptionId): Promise<DatabaseDriver> {
    const driver = await this.createDriverFor(optionId);
    await driver.connect();
    return driver;
  }

  public async execute(sql: string): Promise<SqlResult[]> {
    await this.initFromState();
    let driver: DatabaseDriver;
    try {
      driver = await this.getDriver();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return [
        {
          columns: [],
          rows: [],
          rowsAffected: 0,
          error: msg,
          statementIndex: 0,
          isSelect: false,
          executionTimeMs: 0,
        },
      ];
    }

    try {
      return await driver.execute(sql);
    } catch {
      writeLog(
        "warn",
        `Query failed on active engine ${this.activeOptionId}; attempting single reconnect`,
      );
      try {
        await driver.disconnect();
        this.activeDriver = null;
        const freshDriver = await this.getDriver();
        return await freshDriver.execute(sql);
      } catch (retryErr) {
        const msg =
          retryErr instanceof Error ? retryErr.message : String(retryErr);
        return [
          {
            columns: [],
            rows: [],
            rowsAffected: 0,
            error: `Connection lost: ${msg}`,
            statementIndex: 0,
            isSelect: false,
            executionTimeMs: 0,
          },
        ];
      }
    }
  }

  public async getSchema(): Promise<TableInfo[]> {
    await this.initFromState();
    const driver = await this.getDriver();
    try {
      return await driver.getSchema();
    } catch {
      await driver.disconnect();
      this.activeDriver = null;
      const freshDriver = await this.getDriver();
      return await freshDriver.getSchema();
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const driver = await this.getDriver();
      return await driver.healthCheck();
    } catch {
      return false;
    }
  }

  public async listDatabases(): Promise<string[]> {
    const driver = await this.getDriver();
    return driver.listDatabases();
  }

  public async useDatabase(name: string): Promise<void> {
    await this.getDriver();
    await this.activeDriver!.useDatabase(name);
  }

  public currentDatabase(): string {
    if (this.activeOptionId === "sqlite") return "practice";
    return this.activeDriver?.currentDatabase() ?? "LogixZenPractice";
  }

  public async resetDatabase(setupSql: string): Promise<void> {
    const driver = await this.getDriver();
    await driver.resetDatabase(setupSql);
  }

  public async disposeAll(): Promise<void> {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.activeDriver) {
      await this.activeDriver.disconnect();
      this.activeDriver = null;
    }
  }
}

export const connectionRegistry = new ConnectionRegistry();
