export interface Statement {
  sql: string;
  index: number;
}

export function splitBatches(sql: string): string[][] {
  const lines = sql.split(/\r?\n/);
  const batches: string[][] = [];
  let current: string[] = [];

  const flush = (count: number): void => {
    if (current.length === 0) return;
    const copy = current.slice();
    current = [];
    for (let i = 0; i < count; i += 1) batches.push(copy);
  };

  for (const line of lines) {
    const match = /^\s*GO\s*(\d+)?\s*;?\s*$/i.exec(line);
    if (match !== null) {
      flush(Number(match[1] ?? "1"));
      continue;
    }
    current.push(line);
  }
  flush(1);
  return batches;
}

export function splitSqlStatements(sql: string): Statement[] {
  const statements: Statement[] = [];
  let current = "";
  let single = false;
  let double = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i] ?? "";
    const next = sql[i + 1];

    if (lineComment) {
      current += char;
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }
    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += "/";
        i += 1;
        blockComment = false;
      }
      continue;
    }
    if (single) {
      current += char;
      if (char === "'" && next === "'") {
        current += "'";
        i += 1;
      } else if (char === "'") {
        single = false;
      }
      continue;
    }
    if (double) {
      current += char;
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        double = false;
      }
      continue;
    }

    if (char === "-" && next === "-") {
      lineComment = true;
      current += "--";
      i += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      current += "/*";
      i += 1;
      continue;
    }
    if (char === "'") {
      single = true;
      current += char;
      continue;
    }
    if (char === '"') {
      double = true;
      current += char;
      continue;
    }
    if (char === ";") {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push({ sql: trimmed, index: statements.length });
      }
      current = "";
      continue;
    }
    current += char;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push({ sql: trimmed, index: statements.length });
  }

  return statements;
}

export function unquoteIdentifier(name: string): string {
  let value = name.trim();
  if (value.length >= 2) {
    const first = value.charAt(0);
    const last = value.charAt(value.length - 1);
    const closing: Record<string, string> = {
      "[": "]",
      '"': '"',
      "`": "`",
      "'": "'",
    };
    if (closing[first] === last) value = value.slice(1, -1).trim();
  }
  return value;
}

export function parseUseStatement(sql: string): string | null {
  const match = /^USE\s+(.+)$/i.exec(sql.trim().replace(/;+\s*$/, ""));
  if (match === null) return null;
  const name = unquoteIdentifier(match[1] ?? "");
  return name.length > 0 ? name : null;
}

export interface DatabaseTarget {
  name: string;
  ifClause: boolean;
}

const CREATE_DATABASE =
  /^CREATE\s+DATABASE\s+(IF\s+NOT\s+EXISTS\s+)?((?:\[[^\]]+\])|(?:"[^"]+")|(?:`[^`]+`)|(?:'[^']+')|[A-Za-z_][\w-]*)\s*;?\s*$/i;
const DROP_DATABASE =
  /^DROP\s+DATABASE\s+(IF\s+EXISTS\s+)?((?:\[[^\]]+\])|(?:"[^"]+")|(?:`[^`]+`)|(?:'[^']+')|[A-Za-z_][\w-]*)\s*;?\s*$/i;

function parseDatabaseTarget(
  sql: string,
  regex: RegExp,
): DatabaseTarget | null {
  const match = regex.exec(sql.trim());
  if (match === null) return null;
  const name = unquoteIdentifier(match[2] ?? "");
  if (name.length === 0) return null;
  return { name, ifClause: (match[1] ?? "").trim().length > 0 };
}

export function parseCreateDatabase(sql: string): DatabaseTarget | null {
  return parseDatabaseTarget(sql, CREATE_DATABASE);
}

export function parseDropDatabase(sql: string): DatabaseTarget | null {
  return parseDatabaseTarget(sql, DROP_DATABASE);
}
