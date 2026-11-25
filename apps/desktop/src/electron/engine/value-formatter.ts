import type { SqlRow } from "../../shared/desktop-api";

const MAX_STRING_LENGTH = 10000;

export function formatSqlValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val === "bigint") {
    return val.toString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (Buffer.isBuffer(val)) {
    const preview = val.subarray(0, 16).toString("hex");
    return `<binary ${val.length} bytes: 0x${preview}${val.length > 16 ? "..." : ""}>`;
  }
  if (val instanceof Uint8Array) {
    const buf = Buffer.from(val);
    const preview = buf.subarray(0, 16).toString("hex");
    return `<binary ${buf.length} bytes: 0x${preview}${buf.length > 16 ? "..." : ""}>`;
  }
  if (typeof val === "string") {
    if (val.length > MAX_STRING_LENGTH) {
      return `${val.slice(0, 1000)}... [truncated, total ${val.length} characters]`;
    }
    return val;
  }
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return val;
}

export function formatSqlRow(row: Record<string, unknown>): SqlRow {
  const formatted: SqlRow = {};
  for (const [key, value] of Object.entries(row)) {
    formatted[key] = formatSqlValue(value);
  }
  return formatted;
}

export interface FormattedEngineError {
  code?: string;
  message: string;
  line?: number;
  position?: number;
}

export function formatEngineError(error: unknown): FormattedEngineError {
  if (error instanceof Error) {
    const anyErr = error as unknown as Record<string, unknown>;
    const code =
      typeof anyErr.code === "string" || typeof anyErr.code === "number"
        ? String(anyErr.code)
        : undefined;
    const line =
      typeof anyErr.line === "number"
        ? anyErr.line
        : typeof anyErr.lineNumber === "number"
          ? anyErr.lineNumber
          : undefined;
    const position =
      typeof anyErr.position === "number"
        ? anyErr.position
        : typeof anyErr.col === "number"
          ? anyErr.col
          : undefined;

    return {
      code,
      message: error.message,
      line,
      position,
    };
  }
  return {
    message: String(error),
  };
}
