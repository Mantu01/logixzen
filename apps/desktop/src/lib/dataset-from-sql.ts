import type { Dataset } from "@logixzen/shared/content";
import type { TableInfo } from "@/shared/desktop-api";
import { adaptSchemaSqlToDialect } from "@/shared/dialect-sql";
import type { EngineDialect, EngineOptionId } from "@/shared/engines";

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "db"
  );
}

export function isDatasetForEngine(
  dataset: Dataset,
  optionId: EngineOptionId,
): boolean {
  if (!dataset.engineId) return true;
  return dataset.engineId === optionId;
}

export function filterDatasetsForEngine(
  databases: Dataset[],
  optionId: EngineOptionId,
): Dataset[] {
  return databases.filter((dataset) => isDatasetForEngine(dataset, optionId));
}

export function dbNameFromSql(sql: string, fallback: string): string {
  for (const line of sql.split(/\r?\n/).slice(0, 8)) {
    const match =
      /^--\s*[=\-]{3,}\s*([A-Za-z][A-Za-z0-9_ -]*?)\s*[=\-]{3,}\s*$/.exec(
        line.trim(),
      );
    if (match !== null) {
      const name = match[1]?.trim();
      if (name !== undefined && name.length > 0) return name;
    }
  }
  return fallback;
}

export function tablesToDatasetTables(tables: TableInfo[]): Dataset["tables"] {
  return tables.map((table) => ({
    name: table.name,
    description: undefined,
    columns: table.columns.map((column) => {
      const key = table.foreignKeys.find(
        (relation) => relation.from === column.name,
      );
      return {
        name: column.name,
        type:
          column.type.trim().length > 0 ? column.type.toLowerCase() : "text",
        primaryKey: column.primaryKey,
        foreignKey:
          key === undefined
            ? undefined
            : { table: key.table, column: key.to },
      };
    }),
  }));
}

export function tablesFromDataset(
  dataset: Dataset,
): TableInfo[] {
  return dataset.tables.map((table) => ({
    name: table.name,
    columns: table.columns.map((column, index) => ({
      cid: index,
      name: column.name,
      type: column.type,
      notNull: false,
      defaultValue: null,
      primaryKey: Boolean(column.primaryKey),
    })),
    sampleRows: [],
    primaryKey: table.columns
      .filter((column) => column.primaryKey)
      .map((column) => column.name),
    foreignKeys: table.columns
      .filter((column) => column.foreignKey !== undefined)
      .map((column) => ({
        from: column.name,
        table: column.foreignKey!.table,
        to: column.foreignKey!.column,
      })),
  }));
}

export async function buildDatasetFromSql(
  name: string,
  sql: string,
  engine?: {
    engineId?: EngineOptionId;
    dialect?: EngineDialect;
    sourceDialect?: EngineDialect;
    sharedAcrossEngines?: boolean;
  },
): Promise<Dataset> {
  const bridge = window.logixzen?.database;
  if (bridge === undefined)
    throw new Error("Desktop bridge unavailable. Run the Electron app.");
  const trimmed = name.trim() || "imported-db";
  const sourceDialect = engine?.sourceDialect ?? "sqlite";
  const activeDialect = engine?.dialect ?? sourceDialect;
  const initSql =
    sourceDialect === "sqlite" && activeDialect !== "sqlite"
      ? adaptSchemaSqlToDialect(sql, activeDialect)
      : sql;
  await bridge.initialize(initSql, trimmed);
  const tables = await bridge.getSchema();
  const baseSlug = slugify(trimmed);
  return {
    id:
      engine?.engineId && !engine?.sharedAcrossEngines
        ? `${engine.engineId}-${baseSlug}`
        : baseSlug,
    name: trimmed,
    description: "Imported from a SQL file.",
    setupSql: sql,
    tables: tablesToDatasetTables(tables),
    engineId: engine?.sharedAcrossEngines ? undefined : engine?.engineId,
    dialect: sourceDialect,
  };
}
