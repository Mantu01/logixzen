import type { SqlResult } from "@logixzen/shared/sql-engine";

export function exportToCsv(result: SqlResult): string {
  if (result.columns.length === 0) {
    return "";
  }
  const escape = (value: unknown): string => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    result.columns.map(escape).join(","),
    ...result.rows.map((row) => result.columns.map((column) => escape(row[column])).join(",")),
  ].join("\n");
}

export function exportToJson(result: SqlResult): string {
  return JSON.stringify(result.rows, null, 2);
}

export function toMarkdownTable(result: SqlResult): string {
  if (result.columns.length === 0) {
    return "";
  }
  const header = `| ${result.columns.join(" | ")} |`;
  const separator = `| ${result.columns.map(() => "---").join(" | ")} |`;
  const rows = result.rows.map(
    (row) => `| ${result.columns.map((column) => String(row[column] ?? "")).join(" | ")} |`,
  );
  return [header, separator, ...rows].join("\n");
}
