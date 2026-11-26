import type { TableInfo } from "@/shared/desktop-api";
import type { EngineDialect } from "@/shared/engines";

export const DIALECTS: Array<{ id: EngineDialect; label: string }> = [
  { id: "mysql", label: "MySQL" },
  { id: "postgres", label: "PostgreSQL" },
  { id: "sqlite", label: "SQLite" },
  { id: "tsql", label: "T-SQL" },
];

export function dialectLabel(id: EngineDialect): string {
  return DIALECTS.find((entry) => entry.id === id)?.label ?? id;
}

export function tableMapFrom(tables: TableInfo[]): Record<string, string[]> {
  return Object.fromEntries(
    tables.map((table) => [
      table.name,
      table.columns.map((column) => column.name),
    ]),
  );
}

const FORMAT_KEYWORDS = new Set([
  "select",
  "distinct",
  "from",
  "where",
  "inner",
  "left",
  "right",
  "full",
  "outer",
  "cross",
  "join",
  "on",
  "group",
  "by",
  "having",
  "order",
  "asc",
  "desc",
  "limit",
  "offset",
  "fetch",
  "first",
  "next",
  "rows",
  "only",
  "top",
  "union",
  "all",
  "intersect",
  "except",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "create",
  "database",
  "use",
  "table",
  "alter",
  "drop",
  "truncate",
  "as",
  "and",
  "or",
  "not",
  "in",
  "is",
  "null",
  "between",
  "like",
  "ilike",
  "exists",
  "case",
  "when",
  "then",
  "else",
  "end",
  "with",
  "over",
  "partition",
  "primary",
  "key",
  "foreign",
  "references",
  "unique",
  "default",
  "check",
  "constraint",
  "returning",
]);

const NEWLINE_CLAUSES =
  /\b(FROM|WHERE|(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN|GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|OFFSET|VALUES|SET|UNION(?:\s+ALL)?)\b/gi;

export function formatSql(sql: string): string {
  const tokenPattern =
    /('(?:[^']|'')*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`|--[^\n]*|\/\*[\s\S]*?\*\/|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
  const uppercased = sql.replace(tokenPattern, (token) => {
    if (
      token.startsWith("'") ||
      token.startsWith('"') ||
      token.startsWith("`") ||
      token.startsWith("--") ||
      token.startsWith("/*")
    ) {
      return token;
    }
    return FORMAT_KEYWORDS.has(token.toLowerCase())
      ? token.toUpperCase()
      : token;
  });

  const parts: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < uppercased.length; i += 1) {
    const ch = uppercased[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }
    if (!inSingle && !inDouble && ch === ";") {
      if (current.trim().length > 0) parts.push(`${current.trim()};`);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim().length > 0) parts.push(current.trim());

  return parts
    .map((stmt) =>
      stmt
        .replace(/[ \t]+/g, " ")
        .replace(NEWLINE_CLAUSES, (clause) => `\n${clause.toUpperCase()}`),
    )
    .join("\n\n");
}
