import type { EngineDialect } from "../../shared/engines";

export interface SplitResult {
  statements: string[];
  error?: string;
}

export function checkMetaCommands(
  sql: string,
  dialect: EngineDialect,
): string | null {
  const trimmed = sql.trim();
  if (
    dialect === "postgres" &&
    trimmed.startsWith("\\") &&
    !trimmed.startsWith("\\*")
  ) {
    const cmd = trimmed.split(/\s+/)[0];
    return `psql meta-command "${cmd}" is not valid SQL. Use standard PostgreSQL queries (e.g. SELECT * FROM information_schema.tables).`;
  }
  if (dialect === "sqlite" && trimmed.startsWith(".")) {
    const cmd = trimmed.split(/\s+/)[0];
    return `SQLite dot-command "${cmd}" is not valid SQL. Use standard queries (e.g. SELECT name FROM sqlite_master WHERE type = 'table').`;
  }
  return null;
}

function splitSqlServerBatches(sql: string): string[] {
  const lines = sql.split(/\r?\n/);
  const batches: string[] = [];
  let current: string[] = [];

  const flush = (count: number): void => {
    const text = current.join("\n").trim();
    current = [];
    if (text.length > 0) {
      for (let i = 0; i < count; i += 1) {
        batches.push(text);
      }
    }
  };

  for (const line of lines) {
    const match = /^\s*GO\s*(\d+)?\s*;?\s*$/i.exec(line);
    if (match !== null) {
      const count = match[1] ? Math.max(1, parseInt(match[1], 10)) : 1;
      flush(count);
      continue;
    }
    current.push(line);
  }
  flush(1);
  return batches;
}

function splitMySqlWithDelimiter(sql: string): string[] {
  const statements: string[] = [];
  const lines = sql.split(/\r?\n/);
  let currentDelimiter = ";";
  let currentBuffer = "";

  for (const line of lines) {
    const delimMatch = /^\s*DELIMITER\s+(\S+)\s*$/i.exec(line);
    if (delimMatch !== null && delimMatch[1]) {
      const trimmed = currentBuffer.trim();
      if (trimmed.length > 0) {
        if (currentDelimiter === ";") {
          for (const s of splitStandardStatements(trimmed, "mysql")) {
            statements.push(s);
          }
        } else {
          statements.push(trimmed);
        }
        currentBuffer = "";
      }
      currentDelimiter = delimMatch[1];
      continue;
    }

    currentBuffer += (currentBuffer.length > 0 ? "\n" : "") + line;
    if (currentDelimiter !== ";") {
      const trimmed = currentBuffer.trim();
      if (trimmed.endsWith(currentDelimiter)) {
        const cut = trimmed.slice(0, trimmed.length - currentDelimiter.length).trim();
        if (cut.length > 0) {
          statements.push(cut);
        }
        currentBuffer = "";
      }
    }
  }

  const remaining = currentBuffer.trim();
  if (remaining.length > 0) {
    if (currentDelimiter === ";") {
      for (const s of splitStandardStatements(remaining, "mysql")) {
        statements.push(s);
      }
    } else {
      statements.push(remaining);
    }
  }

  return statements;
}

function splitStandardStatements(
  sql: string,
  dialect: EngineDialect,
): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inBrackets = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;
  let triggerBlockDepth = 0;
  let isTriggerStatement = false;

  const len = sql.length;
  let i = 0;

  while (i < len) {
    const char = sql[i] ?? "";
    const next = sql[i + 1] ?? "";

    if (inLineComment) {
      current += char;
      if (char === "\n") {
        inLineComment = false;
      }
      i += 1;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += "/";
        i += 2;
        inBlockComment = false;
        continue;
      }
      i += 1;
      continue;
    }

    if (dollarTag !== null) {
      if (char === "$" && sql.slice(i).startsWith(dollarTag)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      current += char;
      i += 1;
      continue;
    }

    if (inSingleQuote) {
      current += char;
      if (char === "'" && next === "'") {
        current += "'";
        i += 2;
        continue;
      }
      if (char === "'") {
        inSingleQuote = false;
      }
      i += 1;
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      if (char === '"' && next === '"') {
        current += '"';
        i += 2;
        continue;
      }
      if (char === '"') {
        inDoubleQuote = false;
      }
      i += 1;
      continue;
    }

    if (inBacktick) {
      current += char;
      if (char === "`") {
        inBacktick = false;
      }
      i += 1;
      continue;
    }

    if (inBrackets) {
      current += char;
      if (char === "]" && next === "]") {
        current += "]";
        i += 2;
        continue;
      }
      if (char === "]") {
        inBrackets = false;
      }
      i += 1;
      continue;
    }

    if (char === "-" && next === "-") {
      inLineComment = true;
      current += "--";
      i += 2;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      current += "/*";
      i += 2;
      continue;
    }

    if (dialect === "postgres" && char === "$") {
      const match = /^\$([a-zA-Z0-9_]*)\$/.exec(sql.slice(i));
      if (match !== null) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      i += 1;
      continue;
    }

    if (char === "`") {
      inBacktick = true;
      current += char;
      i += 1;
      continue;
    }

    if (dialect === "tsql" && char === "[") {
      inBrackets = true;
      current += char;
      i += 1;
      continue;
    }

    if (dialect === "sqlite") {
      const remainingWord = sql.slice(i).toUpperCase();
      if (/^CREATE\s+(?:TEMP\s+|TEMPORARY\s+)?TRIGGER\b/.test(remainingWord)) {
        isTriggerStatement = true;
      }
      if (isTriggerStatement) {
        if (/^\bBEGIN\b/.test(remainingWord)) {
          triggerBlockDepth += 1;
        } else if (/^\bEND\b/.test(remainingWord)) {
          triggerBlockDepth = Math.max(0, triggerBlockDepth - 1);
        }
      }
    }

    if (char === ";") {
      if (isTriggerStatement && triggerBlockDepth > 0) {
        current += char;
        i += 1;
        continue;
      }
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = "";
      isTriggerStatement = false;
      triggerBlockDepth = 0;
      i += 1;
      continue;
    }

    current += char;
    i += 1;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
}

export function splitScript(
  sql: string,
  dialect: EngineDialect,
): SplitResult {
  const metaError = checkMetaCommands(sql, dialect);
  if (metaError !== null) {
    return { statements: [], error: metaError };
  }

  if (dialect === "tsql") {
    return { statements: splitSqlServerBatches(sql) };
  }

  if (dialect === "mysql") {
    if (/\bDELIMITER\b/i.test(sql)) {
      return { statements: splitMySqlWithDelimiter(sql) };
    }
  }

  return { statements: splitStandardStatements(sql, dialect) };
}
