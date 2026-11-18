import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { sqlitePracticeFile } from "../../paths";
import type { SqlResult, TableInfo } from "../../../shared/desktop-api";
import type { DatabaseDriver } from "./driver";
import { desktopSqlEngine } from "../engine";

export class SqliteDriver implements DatabaseDriver {
  readonly dialect = "sqlite" as const;

  async connect(): Promise<void> {
    const file = sqlitePracticeFile();
    const dir = dirname(file);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    desktopSqlEngine.openPracticeDatabase(file);
    desktopSqlEngine.use("practice");
  }

  async disconnect(): Promise<void> {}

  async execute(sql: string): Promise<SqlResult[]> {
    return desktopSqlEngine.execute(sql);
  }

  async getSchema(): Promise<TableInfo[]> {
    return desktopSqlEngine.getSchema();
  }

  async getServerVersion(): Promise<string> {
    const res = desktopSqlEngine.execute("SELECT sqlite_version() AS version;");
    const ver = res[0]?.rows[0]?.version;
    return typeof ver === "string" ? `SQLite ${ver}` : "SQLite 3";
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = desktopSqlEngine.execute("SELECT 1 AS ok;");
      return res[0]?.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  async listDatabases(): Promise<string[]> {
    return desktopSqlEngine.list();
  }

  async useDatabase(name: string): Promise<void> {
    desktopSqlEngine.use(name);
  }

  currentDatabase(): string {
    return desktopSqlEngine.activeName() ?? "practice";
  }

  async resetDatabase(setupSql: string): Promise<void> {
    desktopSqlEngine.initialize(setupSql, "practice");
  }
}
