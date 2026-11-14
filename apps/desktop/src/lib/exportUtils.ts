import type { SqlResult } from "@/shared/desktop-api";

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
