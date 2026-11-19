import { DatabaseSync } from "node:sqlite";
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  statfsSync,
} from "node:fs";
import { dirname } from "node:path";
import type { VerificationResult } from "../../shared/engines";
import { sqlitePracticeFile } from "../paths";
import { desktopSqlEngine } from "../sql/engine";
import {
  PRACTICE_MARKER_TABLE,
  PRACTICE_MARKER_VALUE,
  markerStatement,
} from "../state/ownership";
import { updateInstallation, updateInstallationStatus } from "../state/store";
import { writeLog } from "./logger";

export function verifySqlitePractice(
  filePath: string,
): VerificationResult & { version?: string } {
  if (!existsSync(filePath)) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: "Practice database file does not exist.",
    };
  }

  try {
    accessSync(filePath, constants.R_OK | constants.W_OK);
  } catch (err) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: `Practice database file is not writable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    const stats = statfsSync(dirname(filePath));
    const availableBytes = stats.bavail * stats.bsize;
    if (availableBytes < 10 * 1024 * 1024) {
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        detail: "Insufficient disk space (requires at least 10 MB free).",
      };
    }
  } catch {}

  let db: DatabaseSync;
  try {
    db = new DatabaseSync(filePath);
  } catch (err) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: `Failed to open SQLite database: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("PRAGMA busy_timeout = 5000;");
    db.exec("PRAGMA synchronous = NORMAL;");

    const versionRow = db
      .prepare("SELECT 1 AS ready, sqlite_version() AS version;")
      .get() as {
      ready?: number;
      version?: string;
    };
    if (
      !versionRow ||
      versionRow.ready !== 1 ||
      typeof versionRow.version !== "string"
    ) {
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        detail: "Failed to execute trivial select or retrieve SQLite version.",
      };
    }
    const version = versionRow.version;

    db.exec(
      "CREATE TEMP TABLE _logixzen_verify (id INTEGER PRIMARY KEY, note TEXT);",
    );
    db.exec("BEGIN IMMEDIATE;");
    db.exec(
      "INSERT INTO _logixzen_verify (id, note) VALUES (1, 'verification');",
    );
    db.exec("ROLLBACK;");
    const countRow = db
      .prepare("SELECT count(*) AS count FROM _logixzen_verify;")
      .get() as { count?: number };
    db.exec("DROP TABLE IF EXISTS _logixzen_verify;");
    if (!countRow || countRow.count !== 0) {
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        detail: "Transaction rollback inside temporary table failed.",
      };
    }

    const schemaRow = db
      .prepare("SELECT count(*) AS count FROM sqlite_master;")
      .get() as { count?: number };
    if (!schemaRow || typeof schemaRow.count !== "number") {
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        detail: "Failed to read database schema from sqlite_master.",
      };
    }

    db.exec(markerStatement("sqlite"));
    const markerRow = db
      .prepare(`SELECT v FROM ${PRACTICE_MARKER_TABLE} WHERE k = 'owner'`)
      .get() as { v?: string };
    if (markerRow?.v !== PRACTICE_MARKER_VALUE) {
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        detail: "Practice database ownership marker could not be verified.",
      };
    }

    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      detail: `Database verified operational (SQLite ${version})`,
      version,
    };
  } catch (err) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: `Verification query error: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    db.close();
  }
}

export async function activateSqlite(
  signal: AbortSignal,
  onProgress: (stageIndex: number, label: string) => void,
  recordResource: (kind: "files", value: string) => Promise<void>,
): Promise<{ version: string; dataLocation: string }> {
  const dbFile = sqlitePracticeFile();
  const dbDir = dirname(dbFile);

  onProgress(0, "Checking app data location");
  if (signal.aborted) throw new Error("Operation cancelled");

  try {
    mkdirSync(dbDir, { recursive: true, mode: 0o700 });
    accessSync(dbDir, constants.R_OK | constants.W_OK);
  } catch (err) {
    writeLog("error", `Practice directory not accessible: ${String(err)}`);
    throw new Error(
      `Practice directory is not accessible: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    const stats = statfsSync(dbDir);
    const availableBytes = stats.bavail * stats.bsize;
    if (availableBytes < 10 * 1024 * 1024) {
      throw new Error("Insufficient disk space: at least 10 MB free required.");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("Insufficient disk space"))
      throw err;
  }

  const now = new Date().toISOString();
  await updateInstallation({
    optionId: "sqlite",
    engine: "sqlite",
    method: "bundled",
    variant: {
      displayName: "SQLite",
      publisher: "SQLite",
      purpose: "Lightweight practice database with no download and no service.",
      technicalName: "sqlite-bundled",
      dialect: "sqlite",
    },
    status: "activating",
    dataLocation: dbFile,
    createdAt: now,
    updatedAt: now,
    resources: {},
  });

  onProgress(1, "Configuring practice environment");
  if (signal.aborted) throw new Error("Operation cancelled");

  const fileExistedBefore = existsSync(dbFile);
  if (!fileExistedBefore) {
    await recordResource("files", dbFile);
  }

  const db = new DatabaseSync(dbFile);
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("PRAGMA busy_timeout = 5000;");
    db.exec("PRAGMA synchronous = NORMAL;");
    db.exec(markerStatement("sqlite"));
  } finally {
    db.close();
  }

  onProgress(2, "Initializing practice database");
  if (signal.aborted) throw new Error("Operation cancelled");

  await updateInstallationStatus("sqlite", "installed");

  onProgress(3, "Verifying connection");
  if (signal.aborted) throw new Error("Operation cancelled");

  await updateInstallationStatus("sqlite", "verifying");

  const verification = verifySqlitePractice(dbFile);
  if (!verification.ok || !verification.version) {
    await updateInstallationStatus("sqlite", "needs-repair", {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: verification.detail,
    });
    throw new Error(verification.detail ?? "SQLite verification failed.");
  }

  onProgress(4, "Activation complete");

  desktopSqlEngine.openPracticeDatabase(dbFile);
  desktopSqlEngine.use("practice");

  const finishTime = new Date().toISOString();
  await updateInstallation({
    optionId: "sqlite",
    engine: "sqlite",
    method: "bundled",
    variant: {
      displayName: "SQLite",
      publisher: "SQLite",
      purpose: "Lightweight practice database with no download and no service.",
      technicalName: "sqlite-bundled",
      dialect: "sqlite",
    },
    status: "ready",
    installedVersion: verification.version,
    dataLocation: dbFile,
    createdAt: now,
    updatedAt: finishTime,
    lastVerification: {
      ok: true,
      checkedAt: finishTime,
      detail: verification.detail,
    },
    resources: {},
  });

  writeLog(
    "info",
    `SQLite activated successfully (version ${verification.version}) at ${dbFile}`,
  );
  return { version: verification.version, dataLocation: dbFile };
}
