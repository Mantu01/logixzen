import type { EngineDialect } from "../../shared/engines";

export const PRACTICE_MARKER_TABLE = "logixzen_meta";

export const PRACTICE_MARKER_VALUE = "logixzen-practice";

export function ownedName(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

export function markerStatement(dialect: EngineDialect): string {
  const key = `'owner'`;
  const value = `'${PRACTICE_MARKER_VALUE}'`;
  switch (dialect) {
    case "sqlite":
      return [
        `CREATE TABLE IF NOT EXISTS ${PRACTICE_MARKER_TABLE} (k TEXT PRIMARY KEY, v TEXT NOT NULL);`,
        `INSERT OR IGNORE INTO ${PRACTICE_MARKER_TABLE} (k, v) VALUES (${key}, ${value});`,
      ].join("\n");
    case "tsql":
      return [
        `IF OBJECT_ID(N'${PRACTICE_MARKER_TABLE}', N'U') IS NULL CREATE TABLE ${PRACTICE_MARKER_TABLE} (k NVARCHAR(64) PRIMARY KEY, v NVARCHAR(64) NOT NULL);`,
        `IF NOT EXISTS (SELECT 1 FROM ${PRACTICE_MARKER_TABLE} WHERE k = ${key}) INSERT INTO ${PRACTICE_MARKER_TABLE} (k, v) VALUES (${key}, ${value});`,
      ].join("\n");
    case "postgres":
      return [
        `CREATE TABLE IF NOT EXISTS ${PRACTICE_MARKER_TABLE} (k TEXT PRIMARY KEY, v TEXT NOT NULL);`,
        `INSERT INTO ${PRACTICE_MARKER_TABLE} (k, v) VALUES (${key}, ${value}) ON CONFLICT (k) DO NOTHING;`,
      ].join("\n");
    case "mysql":
      return [
        `CREATE TABLE IF NOT EXISTS ${PRACTICE_MARKER_TABLE} (k VARCHAR(64) PRIMARY KEY, v VARCHAR(64) NOT NULL);`,
        `INSERT IGNORE INTO ${PRACTICE_MARKER_TABLE} (k, v) VALUES (${key}, ${value});`,
      ].join("\n");
  }
}
