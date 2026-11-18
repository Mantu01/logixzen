import type { EngineDialect } from "../../shared/engines";
import type { ColumnSpec, TableSpec } from "./schema";

function quoteIdentifier(name: string, dialect: EngineDialect): string {
  switch (dialect) {
    case "tsql":
      return `[${name}]`;
    case "mysql":
      return `\`${name}\``;
    case "postgres":
    case "sqlite":
      return `"${name}"`;
  }
}

function resolveColumnType(col: ColumnSpec, dialect: EngineDialect): string {
  switch (col.type) {
    case "integer":
      return dialect === "sqlite" ? "INTEGER" : "INT";
    case "text":
      if (col.unique || col.primaryKey) {
        return dialect === "tsql"
          ? "NVARCHAR(255)"
          : dialect === "sqlite"
            ? "TEXT"
            : "VARCHAR(255)";
      }
      return dialect === "tsql"
        ? "NVARCHAR(MAX)"
        : dialect === "mysql"
          ? "TEXT"
          : "TEXT";
    case "real":
      switch (dialect) {
        case "sqlite":
          return "REAL";
        case "tsql":
          return "FLOAT";
        case "postgres":
          return "DOUBLE PRECISION";
        case "mysql":
          return "DOUBLE";
      }
      break;
    case "boolean":
      switch (dialect) {
        case "sqlite":
          return "INTEGER";
        case "tsql":
          return "BIT";
        case "postgres":
          return "BOOLEAN";
        case "mysql":
          return "TINYINT(1)";
      }
      break;
    case "datetime":
      switch (dialect) {
        case "sqlite":
        case "postgres":
          return "TEXT";
        case "tsql":
          return "NVARCHAR(64)";
        case "mysql":
          return "VARCHAR(64)";
      }
  }
}

function resolveDefaultValue(
  def: string | number | boolean,
  dialect: EngineDialect,
): string {
  if (typeof def === "number") return String(def);
  if (typeof def === "boolean") return def ? "1" : "0";
  if (def === "(datetime('now'))") {
    switch (dialect) {
      case "sqlite":
        return "(datetime('now'))";
      case "tsql":
        return "CONVERT(VARCHAR(19), GETDATE(), 120)";
      case "postgres":
        return "TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS')";
      case "mysql":
        return "(DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'))";
    }
  }
  if (def === "(date('now'))") {
    switch (dialect) {
      case "sqlite":
        return "(date('now'))";
      case "tsql":
        return "CONVERT(VARCHAR(10), GETDATE(), 120)";
      case "postgres":
        return "TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')";
      case "mysql":
        return "(CURDATE())";
    }
  }
  return String(def);
}

export function generateTableDdl(
  table: TableSpec,
  dialect: EngineDialect,
): string {
  const colDefs: string[] = [];
  const constraints: string[] = [];

  for (const col of table.columns) {
    const qCol = quoteIdentifier(col.name, dialect);
    const typeStr = resolveColumnType(col, dialect);
    const parts = [qCol, typeStr];

    if (col.primaryKey && !table.compositePrimaryKey) {
      parts.push("PRIMARY KEY");
    }
    if (col.nullable === false || (col.primaryKey && !col.nullable)) {
      parts.push("NOT NULL");
    }
    if (col.unique && !col.primaryKey) {
      parts.push("UNIQUE");
    }
    if (col.defaultValue !== undefined) {
      parts.push(`DEFAULT ${resolveDefaultValue(col.defaultValue, dialect)}`);
    }
    if (col.check) {
      parts.push(`CHECK(${col.check})`);
    }
    if (col.references) {
      const refTable = quoteIdentifier(col.references.table, dialect);
      const refCol = quoteIdentifier(col.references.column, dialect);
      const cascade = col.references.onDelete
        ? ` ON DELETE ${col.references.onDelete}`
        : "";
      constraints.push(
        `FOREIGN KEY (${qCol}) REFERENCES ${refTable}(${refCol})${cascade}`,
      );
    }

    colDefs.push(parts.join(" "));
  }

  if (table.compositePrimaryKey && table.compositePrimaryKey.length > 0) {
    const qCols = table.compositePrimaryKey
      .map((c) => quoteIdentifier(c, dialect))
      .join(", ");
    constraints.push(`PRIMARY KEY (${qCols})`);
  }

  if (table.uniqueConstraints) {
    for (const u of table.uniqueConstraints) {
      const qCols = u.map((c) => quoteIdentifier(c, dialect)).join(", ");
      constraints.push(`UNIQUE (${qCols})`);
    }
  }

  if (table.checks) {
    for (const chk of table.checks) {
      constraints.push(`CHECK (${chk})`);
    }
  }

  const allElements = [...colDefs, ...constraints].join(",\n    ");
  const qTable = quoteIdentifier(table.name, dialect);

  if (dialect === "tsql") {
    return `IF OBJECT_ID(N'${table.name}', N'U') IS NULL\nCREATE TABLE ${qTable} (\n    ${allElements}\n);`;
  }
  return `CREATE TABLE IF NOT EXISTS ${qTable} (\n    ${allElements}\n);`;
}

export function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  const str = String(value);
  return `'${str.replace(/'/g, "''")}'`;
}

export function generateInsertStatements(
  table: TableSpec,
  rows: Record<string, unknown>[],
  dialect: EngineDialect,
  batchSize = 50,
): string[] {
  if (rows.length === 0) return [];
  const cols = Object.keys(rows[0]);
  const qCols = cols.map((c) => quoteIdentifier(c, dialect)).join(", ");
  const qTable = quoteIdentifier(table.name, dialect);

  const statements: string[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const valueTuples = chunk.map((row) => {
      const vals = cols
        .map((colName) => formatSqlValue(row[colName]))
        .join(", ");
      return `(${vals})`;
    });
    statements.push(
      `INSERT INTO ${qTable} (${qCols}) VALUES\n${valueTuples.join(",\n")};`,
    );
  }
  return statements;
}

export function generateDeptHeadUpdates(
  updates: Array<{ departmentId: number; headTeacherId: number }>,
  dialect: EngineDialect,
): string[] {
  const qTable = quoteIdentifier("departments", dialect);
  const qHead = quoteIdentifier("head_teacher_id", dialect);
  const qId = quoteIdentifier("id", dialect);
  return updates.map(
    (u) =>
      `UPDATE ${qTable} SET ${qHead} = ${u.headTeacherId} WHERE ${qId} = ${u.departmentId};`,
  );
}

export function generateDropTableSql(
  tableName: string,
  dialect: EngineDialect,
): string {
  switch (dialect) {
    case "tsql":
      return `IF OBJECT_ID(N'${tableName}', N'U') IS NOT NULL DROP TABLE [${tableName}];`;
    case "postgres":
      return `DROP TABLE IF EXISTS "${tableName}" CASCADE;`;
    case "mysql":
      return `DROP TABLE IF EXISTS \`${tableName}\`;`;
    case "sqlite":
      return `DROP TABLE IF EXISTS "${tableName}";`;
  }
}
