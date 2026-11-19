import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseDriver } from "../sql/drivers/driver";
import { backupsDir } from "../paths";
import {
  markerStatement,
  PRACTICE_MARKER_TABLE,
  PRACTICE_MARKER_VALUE,
} from "../state/ownership";
import {
  DEPT_HEAD_UPDATES,
  PRACTICE_DROP_ORDER,
  PRACTICE_SEED_DATA,
  PRACTICE_TABLE_NAMES,
  PRACTICE_TABLES,
} from "./schema";
import {
  generateDeptHeadUpdates,
  generateDropTableSql,
  generateInsertStatements,
  generateTableDdl,
} from "./ddl-generator";

export const PRACTICE_SCHEMA_VERSION = "1";

interface PracticeInitResult {
  status: "initialized" | "kept";
  tablesCreated: number;
  rowsInserted: number;
  message: string;
}

interface PracticeResetResult {
  status: "reset";
  tablesCreated: number;
  rowsInserted: number;
  backupPath: string;
  message: string;
}

interface PracticeVerificationResult {
  ok: boolean;
  tableCount: number;
  practiceTableCount: number;
  rowCounts: Record<string, number>;
  totalRows: number;
  sampleSelectOk: boolean;
  error?: string;
}

async function ensureMarkerTable(driver: DatabaseDriver): Promise<void> {
  const ddl = markerStatement(driver.dialect);
  await driver.execute(ddl);
}

async function setMarkerValue(
  driver: DatabaseDriver,
  key: string,
  value: string,
): Promise<void> {
  const k = `'${key.replace(/'/g, "''")}'`;
  const v = `'${value.replace(/'/g, "''")}'`;
  switch (driver.dialect) {
    case "sqlite":
      await driver.execute(
        `INSERT OR REPLACE INTO ${PRACTICE_MARKER_TABLE} (k, v) VALUES (${k}, ${v});`,
      );
      break;
    case "tsql":
      await driver.execute(
        `IF EXISTS (SELECT 1 FROM ${PRACTICE_MARKER_TABLE} WHERE k = ${k}) ` +
          `UPDATE ${PRACTICE_MARKER_TABLE} SET v = ${v} WHERE k = ${k}; ` +
          `ELSE INSERT INTO ${PRACTICE_MARKER_TABLE} (k, v) VALUES (${k}, ${v});`,
      );
      break;
    case "postgres":
      await driver.execute(
        `INSERT INTO ${PRACTICE_MARKER_TABLE} (k, v) VALUES (${k}, ${v}) ` +
          `ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;`,
      );
      break;
    case "mysql":
      await driver.execute(
        `INSERT INTO ${PRACTICE_MARKER_TABLE} (k, v) VALUES (${k}, ${v}) ` +
          `ON DUPLICATE KEY UPDATE v = VALUES(v);`,
      );
      break;
  }
}

async function getMarkerValues(
  driver: DatabaseDriver,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const result = await driver.execute(
      `SELECT k, v FROM ${PRACTICE_MARKER_TABLE};`,
    );
    if (result.length > 0 && result[0].rows) {
      for (const row of result[0].rows) {
        if (typeof row.k === "string" && typeof row.v === "string") {
          map.set(row.k, row.v);
        }
      }
    }
  } catch {}
  return map;
}

async function listDriverTables(driver: DatabaseDriver): Promise<string[]> {
  const schema = await driver.getSchema();
  return schema.map((t) => t.name);
}

async function detectLearnerData(
  driver: DatabaseDriver,
): Promise<boolean> {
  const tables = await listDriverTables(driver);
  const lowerTables = tables.map((t) => t.toLowerCase());
  const appSet = new Set([
    ...PRACTICE_TABLE_NAMES.map((t) => t.toLowerCase()),
    PRACTICE_MARKER_TABLE,
  ]);

  const learnerTables = lowerTables.filter((t) => !appSet.has(t));
  if (learnerTables.length > 0) return true;

  if (lowerTables.includes("students")) {
    try {
      const res = await driver.execute("SELECT COUNT(*) AS c FROM students;");
      const count = Number(res[0]?.rows?.[0]?.c ?? res[0]?.rows?.[0]?.C ?? 0);
      if (count > 30) return true;
    } catch {}
  }

  return false;
}

export async function initializePracticeEnvironment(
  driver: DatabaseDriver,
): Promise<PracticeInitResult> {
  await ensureMarkerTable(driver);
  const markers = await getMarkerValues(driver);
  const existingTables = (await listDriverTables(driver)).map((t) =>
    t.toLowerCase(),
  );
  const allAppTablesExist = PRACTICE_TABLE_NAMES.every((t) =>
    existingTables.includes(t.toLowerCase()),
  );

  const hasLearnerData = await detectLearnerData(driver);
  const isVersionCurrent =
    markers.get("schema_version") === PRACTICE_SCHEMA_VERSION;

  if (allAppTablesExist && isVersionCurrent) {
    if (hasLearnerData) {
      return {
        status: "kept",
        tablesCreated: 0,
        rowsInserted: 0,
        message: "Practice schema is current. Existing learner data was kept.",
      };
    }
    return {
      status: "kept",
      tablesCreated: 0,
      rowsInserted: 0,
      message: "Practice environment already initialized.",
    };
  }

  let tablesCreated = 0;
  let rowsInserted = 0;

  for (const table of PRACTICE_TABLES) {
    const tableExists = existingTables.includes(table.name.toLowerCase());
    if (!tableExists) {
      const ddl = generateTableDdl(table, driver.dialect);
      await driver.execute(ddl);
      tablesCreated += 1;

      const raw = PRACTICE_SEED_DATA[table.name];
      if (raw && raw.rows.length > 0) {
        const inserts = generateInsertStatements(
          table,
          raw.rows,
          driver.dialect,
        );
        for (const sql of inserts) {
          await driver.execute(sql);
        }
        rowsInserted += raw.rows.length;
      }
    }
  }

  if (!existingTables.includes("departments")) {
    const updates = generateDeptHeadUpdates(DEPT_HEAD_UPDATES, driver.dialect);
    for (const sql of updates) {
      await driver.execute(sql);
    }
  }

  await setMarkerValue(driver, "owner", PRACTICE_MARKER_VALUE);
  await setMarkerValue(driver, "schema_version", PRACTICE_SCHEMA_VERSION);
  await setMarkerValue(driver, "app_tables", PRACTICE_TABLE_NAMES.join(","));

  return {
    status: "initialized",
    tablesCreated,
    rowsInserted,
    message: `Practice environment initialized (${tablesCreated} tables created, ${rowsInserted} rows inserted).`,
  };
}

async function createPracticeBackup(
  driver: DatabaseDriver,
): Promise<string> {
  const dir = backupsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = join(dir, `backup-practice-${timestamp}.json`);

  const tables = await listDriverTables(driver);
  const dump: Record<string, unknown[]> = {};

  for (const table of tables) {
    try {
      const res = await driver.execute(
        `SELECT * FROM ${driver.dialect === "tsql" ? `[${table}]` : `"${table}"`};`,
      );
      dump[table] = res[0]?.rows ?? [];
    } catch {
      dump[table] = [];
    }
  }

  const payload = {
    timestamp: new Date().toISOString(),
    dialect: driver.dialect,
    tables: dump,
  };

  writeFileSync(backupFile, JSON.stringify(payload, null, 2), "utf8");
  return backupFile;
}

export async function resetPracticeEnvironment(
  driver: DatabaseDriver,
  options: { confirmed: boolean },
): Promise<PracticeResetResult> {
  if (!options.confirmed) {
    throw new Error("Reset requires explicit confirmation.");
  }

  const backupPath = await createPracticeBackup(driver);

  for (const tableName of PRACTICE_DROP_ORDER) {
    const dropSql = generateDropTableSql(tableName, driver.dialect);
    await driver.execute(dropSql);
  }

  let tablesCreated = 0;
  let rowsInserted = 0;

  for (const table of PRACTICE_TABLES) {
    const ddl = generateTableDdl(table, driver.dialect);
    await driver.execute(ddl);
    tablesCreated += 1;

    const raw = PRACTICE_SEED_DATA[table.name];
    if (raw && raw.rows.length > 0) {
      const inserts = generateInsertStatements(table, raw.rows, driver.dialect);
      for (const sql of inserts) {
        await driver.execute(sql);
      }
      rowsInserted += raw.rows.length;
    }
  }

  const updates = generateDeptHeadUpdates(DEPT_HEAD_UPDATES, driver.dialect);
  for (const sql of updates) {
    await driver.execute(sql);
  }

  await ensureMarkerTable(driver);
  await setMarkerValue(driver, "owner", PRACTICE_MARKER_VALUE);
  await setMarkerValue(driver, "schema_version", PRACTICE_SCHEMA_VERSION);
  await setMarkerValue(driver, "app_tables", PRACTICE_TABLE_NAMES.join(","));

  return {
    status: "reset",
    tablesCreated,
    rowsInserted,
    backupPath,
    message: `Practice environment reset (${tablesCreated} tables reseeded, ${rowsInserted} rows inserted).`,
  };
}

export async function verifyPracticeEnvironment(
  driver: DatabaseDriver,
): Promise<PracticeVerificationResult> {
  const tables = await listDriverTables(driver);
  const lowerTables = tables.map((t) => t.toLowerCase());

  const rowCounts: Record<string, number> = {};
  let totalRows = 0;

  for (const name of PRACTICE_TABLE_NAMES) {
    if (!lowerTables.includes(name.toLowerCase())) {
      return {
        ok: false,
        tableCount: tables.length,
        practiceTableCount: 0,
        rowCounts,
        totalRows: 0,
        sampleSelectOk: false,
        error: `Practice table "${name}" is missing.`,
      };
    }
    const qTable = driver.dialect === "tsql" ? `[${name}]` : `"${name}"`;
    const res = await driver.execute(`SELECT COUNT(*) AS c FROM ${qTable};`);
    const c = Number(res[0]?.rows?.[0]?.c ?? res[0]?.rows?.[0]?.C ?? 0);
    rowCounts[name] = c;
    totalRows += c;
  }

  let sampleSelectOk = false;
  try {
    const sample = await driver.execute(
      "SELECT id, name FROM departments WHERE id = 1;",
    );
    sampleSelectOk = Boolean(sample[0]?.rows && sample[0].rows.length === 1);
  } catch {
    sampleSelectOk = false;
  }

  return {
    ok: sampleSelectOk && totalRows >= 373,
    tableCount: tables.length,
    practiceTableCount: PRACTICE_TABLE_NAMES.length,
    rowCounts,
    totalRows,
    sampleSelectOk,
  };
}
