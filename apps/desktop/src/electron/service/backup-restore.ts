import crypto from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  statfsSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { backupsDir, sqlitePracticeFile } from "../paths";
import { PRACTICE_DROP_ORDER, PRACTICE_TABLES } from "../practice/schema";
import {
  generateDeptHeadUpdates,
  generateDropTableSql,
  generateInsertStatements,
  generateTableDdl,
} from "../practice/ddl-generator";
import { DEPT_HEAD_UPDATES } from "../practice/schema";
import {
  PRACTICE_SCHEMA_VERSION,
  verifyPracticeEnvironment,
  type PracticeVerificationResult,
} from "../practice/seeder";
import type { DatabaseDriver } from "../sql/drivers/driver";
import { ENGINE_CATALOG } from "../../shared/engine-catalog";
import type { BackupManifest, EngineOptionId } from "../../shared/engines";
import { writeLog } from "./logger";

export const MIN_BACKUP_DISK_BYTES = 50 * 1024 * 1024;
export const DEFAULT_AUTOMATIC_BACKUP_RETENTION = 5;

export interface BackupOptions {
  isAutomatic?: boolean;
  destinationPath?: string;
  minDiskBytes?: number;
}

export interface BackupExecutionResult {
  manifest: BackupManifest;
  manifestPath: string;
  artifactPath: string;
}

export function checkBackupDiskSpace(
  dir: string,
  minBytes = MIN_BACKUP_DISK_BYTES,
): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  try {
    const stats = statfsSync(dir);
    const available = stats.bavail * stats.bsize;
    if (available < minBytes) {
      throw new Error(
        `Insufficient disk space: at least ${Math.round(minBytes / (1024 * 1024))} MB free required in backups directory.`,
      );
    }
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Insufficient disk space")
    ) {
      throw err;
    }
  }
}

export function computeFileSha256(filePath: string): string {
  const content = readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function resolveCatalogEntry(optionId: EngineOptionId) {
  const entry = ENGINE_CATALOG.find((e) => e.id === optionId);
  if (!entry) {
    throw new Error(`Unrecognized engine option: ${optionId}`);
  }
  return entry;
}

function generateSafeFilename(
  dir: string,
  baseName: string,
  ext: string,
): string {
  let candidate = join(dir, `${baseName}${ext}`);
  let counter = 1;
  while (existsSync(candidate)) {
    candidate = join(dir, `${baseName}-${counter}${ext}`);
    counter += 1;
  }
  return candidate;
}

export async function createBackup(
  driver: DatabaseDriver,
  optionId: EngineOptionId,
  options?: BackupOptions,
): Promise<BackupExecutionResult> {
  const entry = resolveCatalogEntry(optionId);
  const dir = backupsDir();
  const minBytes = options?.minDiskBytes ?? MIN_BACKUP_DISK_BYTES;

  checkBackupDiskSpace(dir, minBytes);

  const isAutomatic = options?.isAutomatic ?? false;
  const now = new Date();
  const timestampStr = now.toISOString().replace(/[:.]/g, "-");
  const ext = entry.dialect === "sqlite" ? ".db" : ".sql";
  const defaultBaseName = `backup-${optionId}-${timestampStr}`;

  let artifactPath = options?.destinationPath;
  if (!artifactPath) {
    artifactPath = generateSafeFilename(dir, defaultBaseName, ext);
  } else if (existsSync(artifactPath)) {
    throw new Error(`Destination backup file already exists: ${artifactPath}`);
  }

  let tableCount = 0;
  let rowCount = 0;

  if (entry.dialect === "sqlite") {
    try {
      await driver.execute("PRAGMA wal_checkpoint(TRUNCATE);");
    } catch (checkpointErr) {
      writeLog(
        "warn",
        `SQLite WAL checkpoint failed: ${checkpointErr instanceof Error ? checkpointErr.message : String(checkpointErr)}`,
      );
    }

    const sqliteSource = sqlitePracticeFile();
    if (!existsSync(sqliteSource)) {
      throw new Error(
        `SQLite practice database file not found at ${sqliteSource}`,
      );
    }

    copyFileSync(sqliteSource, artifactPath);

    const verification = await verifyPracticeEnvironment(driver);
    tableCount = verification.tableCount;
    rowCount = verification.totalRows;
  } else {
    const dumpStatements: string[] = [
      `-- LogixZen Practice Backup Dump`,
      `-- Engine: ${entry.engine}`,
      `-- Dialect: ${entry.dialect}`,
      `-- CreatedAt: ${now.toISOString()}`,
      `-- SchemaVersion: ${PRACTICE_SCHEMA_VERSION}`,
    ];

    for (const tableName of PRACTICE_DROP_ORDER) {
      dumpStatements.push(generateDropTableSql(tableName, entry.dialect));
    }

    for (const table of PRACTICE_TABLES) {
      tableCount += 1;
      dumpStatements.push(generateTableDdl(table, entry.dialect));

      const qTable =
        entry.dialect === "tsql" ? `[${table.name}]` : `"${table.name}"`;
      try {
        const res = await driver.execute(`SELECT * FROM ${qTable};`);
        const rows = (res[0]?.rows ?? []) as Record<string, unknown>[];
        if (rows.length > 0) {
          rowCount += rows.length;
          const inserts = generateInsertStatements(table, rows, entry.dialect);
          dumpStatements.push(...inserts);
        }
      } catch {}
    }

    const deptHeadUpdates = generateDeptHeadUpdates(
      DEPT_HEAD_UPDATES,
      entry.dialect,
    );
    dumpStatements.push(...deptHeadUpdates);

    writeFileSync(artifactPath, dumpStatements.join("\n;\n") + "\n;", "utf8");
  }

  const stat = statSync(artifactPath);
  if (stat.size === 0) {
    try {
      unlinkSync(artifactPath);
    } catch {}
    throw new Error(`Backup creation failed: empty artifact file generated.`);
  }

  const sha256 = computeFileSha256(artifactPath);
  const manifest: BackupManifest = {
    manifestVersion: 1,
    engine: entry.engine,
    optionId,
    dialect: entry.dialect,
    practiceSchemaVersion: PRACTICE_SCHEMA_VERSION,
    createdAt: now.toISOString(),
    isAutomatic,
    artifactFile: basename(artifactPath),
    artifactSizeBytes: stat.size,
    sha256,
    tableCount,
    rowCount,
  };

  const manifestPath = `${artifactPath}.manifest.json`;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  writeLog(
    "info",
    `Backup successfully created: ${artifactPath} (${rowCount} rows, ${stat.size} bytes)`,
  );

  if (isAutomatic) {
    try {
      cleanupBackups(DEFAULT_AUTOMATIC_BACKUP_RETENTION);
    } catch {}
  }

  return { manifest, manifestPath, artifactPath };
}

export function listBackups(filterOptionId?: EngineOptionId): BackupManifest[] {
  const dir = backupsDir();
  if (!existsSync(dir)) {
    return [];
  }

  const files = readdirSync(dir);
  const manifests: BackupManifest[] = [];

  for (const file of files) {
    if (!file.endsWith(".manifest.json")) continue;
    const fullManifestPath = join(dir, file);
    try {
      const raw = readFileSync(fullManifestPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<BackupManifest>;
      if (
        parsed.manifestVersion === 1 &&
        typeof parsed.engine === "string" &&
        typeof parsed.optionId === "string" &&
        typeof parsed.artifactFile === "string" &&
        typeof parsed.sha256 === "string"
      ) {
        if (!filterOptionId || parsed.optionId === filterOptionId) {
          const artifactFullPath = join(dir, parsed.artifactFile);
          if (existsSync(artifactFullPath)) {
            manifests.push(parsed as BackupManifest);
          }
        }
      }
    } catch {}
  }

  return manifests.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function restoreBackup(
  driver: DatabaseDriver,
  optionId: EngineOptionId,
  manifestPath: string,
): Promise<PracticeVerificationResult> {
  if (!existsSync(manifestPath)) {
    throw new Error(`Backup manifest not found: ${manifestPath}`);
  }

  const raw = readFileSync(manifestPath, "utf8");
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(raw) as BackupManifest;
  } catch {
    throw new Error(`Invalid or corrupt backup manifest JSON: ${manifestPath}`);
  }

  const entry = resolveCatalogEntry(optionId);
  if (manifest.dialect !== entry.dialect || manifest.engine !== entry.engine) {
    throw new Error(
      `Backup mismatch: cannot restore ${manifest.engine} (${manifest.dialect}) backup into ${entry.engine} (${entry.dialect}).`,
    );
  }

  const dir = dirname(manifestPath);
  const artifactPath = join(dir, manifest.artifactFile);

  if (!existsSync(artifactPath)) {
    throw new Error(`Backup artifact file missing: ${artifactPath}`);
  }

  const stat = statSync(artifactPath);
  if (stat.size === 0) {
    throw new Error(`Backup artifact file is empty: ${artifactPath}`);
  }

  const actualSha256 = computeFileSha256(artifactPath);
  if (actualSha256 !== manifest.sha256) {
    throw new Error(
      `Backup artifact integrity check failed: SHA-256 checksum mismatch (expected ${manifest.sha256}, got ${actualSha256}).`,
    );
  }

  writeLog("info", `Taking pre-restore safety backup for ${optionId}`);
  const safetyBackup = await createBackup(driver, optionId, {
    isAutomatic: true,
  });

  try {
    if (entry.dialect === "sqlite") {
      try {
        await driver.execute("PRAGMA wal_checkpoint(TRUNCATE);");
      } catch {}
      const sqliteDest = sqlitePracticeFile();
      copyFileSync(artifactPath, sqliteDest);
      await driver.connect();
    } else {
      const dumpText = readFileSync(artifactPath, "utf8");
      const statements = dumpText
        .split(/;\s*[\r\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      for (const sql of statements) {
        await driver.execute(sql);
      }
    }

    const verification = await verifyPracticeEnvironment(driver);
    if (!verification.ok) {
      throw new Error(
        verification.error ?? "Post-restore practice verification failed.",
      );
    }

    writeLog(
      "info",
      `Restore completed and verified for ${optionId}: ${verification.totalRows} rows.`,
    );
    return verification;
  } catch (restoreErr) {
    writeLog(
      "error",
      `Restore failed: ${restoreErr instanceof Error ? restoreErr.message : String(restoreErr)}; rolling back to safety backup.`,
    );
    try {
      if (entry.dialect === "sqlite") {
        copyFileSync(safetyBackup.artifactPath, sqlitePracticeFile());
        await driver.connect();
      } else {
        const rollbackDump = readFileSync(safetyBackup.artifactPath, "utf8");
        const stmts = rollbackDump
          .split(/;\s*[\r\n]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith("--"));
        for (const sql of stmts) {
          await driver.execute(sql);
        }
      }
      await verifyPracticeEnvironment(driver);
      writeLog("info", `Rollback to safety backup completed successfully.`);
    } catch (rollbackErr) {
      writeLog(
        "error",
        `Rollback also failed: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`,
      );
    }

    throw restoreErr;
  }
}

export function cleanupBackups(
  keepCount = DEFAULT_AUTOMATIC_BACKUP_RETENTION,
): {
  deletedCount: number;
  freedBytes: number;
} {
  const dir = backupsDir();
  if (!existsSync(dir)) {
    return { deletedCount: 0, freedBytes: 0 };
  }

  const files = readdirSync(dir);
  const automaticList: Array<{
    manifestPath: string;
    artifactPath: string;
    createdAt: number;
    size: number;
  }> = [];

  for (const file of files) {
    if (!file.endsWith(".manifest.json")) continue;
    const manifestPath = join(dir, file);
    try {
      const raw = readFileSync(manifestPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<BackupManifest>;
      if (parsed.isAutomatic && parsed.artifactFile) {
        const artifactPath = join(dir, parsed.artifactFile);
        let size = 0;
        if (existsSync(artifactPath)) {
          size = statSync(artifactPath).size;
        }
        automaticList.push({
          manifestPath,
          artifactPath,
          createdAt: new Date(parsed.createdAt ?? 0).getTime(),
          size,
        });
      }
    } catch {}
  }

  automaticList.sort((a, b) => b.createdAt - a.createdAt);

  let deletedCount = 0;
  let freedBytes = 0;

  if (automaticList.length > keepCount) {
    const toDelete = automaticList.slice(keepCount);
    for (const item of toDelete) {
      try {
        if (existsSync(item.artifactPath)) {
          unlinkSync(item.artifactPath);
          freedBytes += item.size;
        }
      } catch {}
      try {
        if (existsSync(item.manifestPath)) {
          unlinkSync(item.manifestPath);
        }
      } catch {}
      deletedCount += 1;
    }
  }

  return { deletedCount, freedBytes };
}
