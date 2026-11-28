import type { EngineDialect } from "./engines";

export function dialectLabel(dialect: EngineDialect): string {
  switch (dialect) {
    case "postgres":
      return "PostgreSQL";
    case "mysql":
      return "MySQL";
    case "tsql":
      return "T-SQL";
    case "sqlite":
    default:
      return "SQLite";
  }
}

export function dialectShortLabel(dialect: EngineDialect): string {
  switch (dialect) {
    case "postgres":
      return "pgSQL";
    case "mysql":
      return "MySQL";
    case "tsql":
      return "T-SQL";
    case "sqlite":
    default:
      return "SQLite";
  }
}

export function looksLikeSqliteSchema(sql: string): boolean {
  return /\bINTEGER\s+PRIMARY\s+KEY\b/i.test(sql) ||
    /\bAUTOINCREMENT\b/i.test(sql) ||
    /\(\s*(?:datetime|date)\(\s*'now'\s*\)\s*\)/i.test(sql) ||
    /^\s*PRAGMA\b/im.test(sql);
}

function defaultTimestampExpr(dialect: EngineDialect): string {
  switch (dialect) {
    case "tsql":
      return "CONVERT(VARCHAR(19), GETDATE(), 120)";
    case "postgres":
      return "TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS')";
    case "mysql":
      return "(DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'))";
    default:
      return "(datetime('now'))";
  }
}

function defaultDateExpr(dialect: EngineDialect): string {
  switch (dialect) {
    case "tsql":
      return "CONVERT(VARCHAR(10), GETDATE(), 120)";
    case "postgres":
      return "TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')";
    case "mysql":
      return "(CURDATE())";
    default:
      return "(date('now'))";
  }
}

function runtimeTimestampExpr(dialect: EngineDialect): string {
  switch (dialect) {
    case "tsql":
      return "CONVERT(VARCHAR(19), GETDATE(), 120)";
    case "postgres":
      return "TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS')";
    case "mysql":
      return "DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')";
    default:
      return "datetime('now')";
  }
}

function runtimeDateExpr(dialect: EngineDialect): string {
  switch (dialect) {
    case "tsql":
      return "CONVERT(VARCHAR(10), GETDATE(), 120)";
    case "postgres":
      return "TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')";
    case "mysql":
      return "DATE_FORMAT(CURDATE(), '%Y-%m-%d')";
    default:
      return "date('now')";
  }
}

function adaptCreateTableBody(body: string, dialect: EngineDialect): string {
  const lines = splitTopLevelComma(body);
  return lines
    .map((segment) => {
      const trimmed = segment.trim();
      if (!trimmed) return segment;
      if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(trimmed)) {
        return segment;
      }

      let updated = segment;
      updated = updated.replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, "INT PRIMARY KEY");
      updated = updated.replace(/\bINTEGER\s+PRIMARY\s+KEY\b/gi, "INT PRIMARY KEY");
      updated = updated.replace(/\bAUTOINCREMENT\b/gi, "");

      if (/\b(date|datetime)\(\s*'now'\s*\)/i.test(updated)) {
        const dtType = dialect === "tsql" ? "NVARCHAR(64)" : dialect === "mysql" ? "VARCHAR(64)" : "TEXT";
        updated = updated.replace(/\bTEXT\b/gi, dtType);
        updated = updated.replace(/\(\s*datetime\(\s*'now'\s*\)\s*\)/gi, defaultTimestampExpr(dialect));
        updated = updated.replace(/\(\s*date\(\s*'now'\s*\)\s*\)/gi, defaultDateExpr(dialect));
      } else {
        const constrained = /\b(PRIMARY\s+KEY|UNIQUE|DEFAULT|CHECK)\b/i.test(updated);
        if (dialect === "tsql") {
          updated = updated.replace(/\bTEXT\b/gi, constrained ? "NVARCHAR(255)" : "NVARCHAR(MAX)");
        } else if (dialect === "mysql" && constrained) {
          updated = updated.replace(/\bTEXT\b/gi, "VARCHAR(255)");
        } else if (dialect === "postgres" && constrained) {
          updated = updated.replace(/\bTEXT\b/gi, "VARCHAR(255)");
        }
      }

      if (dialect === "postgres") {
        updated = updated.replace(/\bREAL\b/gi, "DOUBLE PRECISION");
      } else if (dialect === "mysql") {
        updated = updated.replace(/\bREAL\b/gi, "DOUBLE");
      } else if (dialect === "tsql") {
        updated = updated.replace(/\bREAL\b/gi, "FLOAT");
      }

      updated = updated.replace(/\bINTEGER\b/gi, "INT");
      return updated;
    })
    .join(",");
}

function splitTopLevelComma(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inSingle = false;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'") {
      if (inSingle && text[i + 1] === "'") {
        i += 1;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }
    if (inSingle) continue;
    if (ch === "(") depth += 1;
    else if (ch === ")" && depth > 0) depth -= 1;
    else if (ch === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

export function adaptSchemaSqlToDialect(
  sql: string,
  targetDialect: EngineDialect,
): string {
  if (targetDialect === "sqlite") return sql;

  let output = sql.replace(/^\s*PRAGMA\b[^;]*;?\s*$/gim, "");

  if (targetDialect === "mysql") {
    output = output.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, "INSERT IGNORE INTO");
    output = output.replace(/\bINSERT\s+OR\s+REPLACE\s+INTO\b/gi, "REPLACE INTO");
  } else if (targetDialect === "postgres" || targetDialect === "tsql") {
    output = output.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, "INSERT INTO");
  }

  const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`[]?([A-Za-z_][A-Za-z0-9_]*)["`\]]?)\s*\(/gi;
  let result = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = createRegex.exec(output)) !== null) {
    result += output.slice(cursor, match.index);
    const tableName = match[1];
    const openParenIndex = createRegex.lastIndex - 1;
    const closeParenIndex = findMatchingParen(output, openParenIndex);
    if (closeParenIndex === -1) {
      result += output.slice(match.index);
      return result;
    }
    const rawBody = output.slice(openParenIndex + 1, closeParenIndex);
    const adaptedBody = adaptCreateTableBody(rawBody, targetDialect);
    if (targetDialect === "tsql") {
      result += `IF OBJECT_ID(N'${tableName}', N'U') IS NULL\nCREATE TABLE [${tableName}] (${adaptedBody})`;
    } else if (targetDialect === "mysql") {
      result += `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${adaptedBody})`;
    } else {
      result += `CREATE TABLE IF NOT EXISTS "${tableName}" (${adaptedBody})`;
    }
    cursor = closeParenIndex + 1;
    createRegex.lastIndex = cursor;
  }

  result += output.slice(cursor);
  return result;
}

function findMatchingParen(text: string, openIndex: number): number {
  let depth = 0;
  let inSingle = false;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'") {
      if (inSingle && text[i + 1] === "'") {
        i += 1;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }
    if (inSingle) continue;
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function mapOutsideStrings(
  sql: string,
  transform: (chunk: string) => string,
): string {
  const segments: string[] = [];
  let i = 0;
  let plainStart = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'") {
      if (i > plainStart) segments.push(transform(sql.slice(plainStart, i)));
      const strStart = i;
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      segments.push(sql.slice(strStart, i));
      plainStart = i;
      continue;
    }
    i += 1;
  }
  if (plainStart < sql.length) {
    segments.push(transform(sql.slice(plainStart)));
  }
  return segments.join("");
}

function findFirstConcatOperator(sql: string): number {
  let inSingle = false;
  for (let i = 0; i < sql.length - 1; i += 1) {
    if (sql[i] === "'") {
      if (inSingle && sql[i + 1] === "'") i += 1;
      else inSingle = !inSingle;
      continue;
    }
    if (!inSingle && sql[i] === "|" && sql[i + 1] === "|") {
      return i;
    }
  }
  return -1;
}

function scanLeftOperandStart(sql: string, opIndex: number): number {
  let i = opIndex - 1;
  while (i >= 0 && /\s/.test(sql[i]!)) i -= 1;
  if (i < 0) return 0;

  if (sql[i] === "'") {
    i -= 1;
    while (i >= 0) {
      if (sql[i] === "'") {
        if (i > 0 && sql[i - 1] === "'") {
          i -= 2;
          continue;
        }
        return i;
      }
      i -= 1;
    }
    return 0;
  }

  if (sql[i] === ")") {
    let depth = 1;
    i -= 1;
    while (i >= 0 && depth > 0) {
      if (sql[i] === "'") {
        i -= 1;
        while (i >= 0) {
          if (sql[i] === "'") {
            if (i > 0 && sql[i - 1] === "'") {
              i -= 2;
              continue;
            }
            break;
          }
          i -= 1;
        }
      } else if (sql[i] === ")") {
        depth += 1;
      } else if (sql[i] === "(") {
        depth -= 1;
      }
      i -= 1;
    }
    while (i >= 0 && /\s/.test(sql[i]!)) i -= 1;
    while (i >= 0 && /[A-Za-z0-9_.$`]/.test(sql[i]!)) i -= 1;
    return i + 1;
  }

  while (i >= 0 && /[A-Za-z0-9_.$`]/.test(sql[i]!)) i -= 1;
  return i + 1;
}

function scanRightOperandEnd(sql: string, afterOpIndex: number): number {
  let i = afterOpIndex;
  while (i < sql.length && /\s/.test(sql[i]!)) i += 1;
  if (i >= sql.length) return sql.length;

  if (sql[i] === "'") {
    i += 1;
    while (i < sql.length) {
      if (sql[i] === "'") {
        if (sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        return i + 1;
      }
      i += 1;
    }
    return sql.length;
  }

  while (i < sql.length && /[A-Za-z0-9_.$`]/.test(sql[i]!)) i += 1;
  const afterIdent = i;
  let lookahead = i;
  while (lookahead < sql.length && /\s/.test(sql[lookahead]!)) lookahead += 1;
  if (sql[lookahead] === "(") {
    const close = findMatchingParen(sql, lookahead);
    return close === -1 ? sql.length : close + 1;
  }
  return afterIdent;
}

function rewriteConcatForMysql(sql: string): string {
  let current = sql;
  for (let guard = 0; guard < 32; guard += 1) {
    const firstOp = findFirstConcatOperator(current);
    if (firstOp === -1) break;
    const spanStart = scanLeftOperandStart(current, firstOp);
    const terms: string[] = [current.slice(spanStart, firstOp).trim()];
    let cursor = firstOp;
    while (cursor !== -1) {
      const termStart = cursor + 2;
      const termEnd = scanRightOperandEnd(current, termStart);
      terms.push(current.slice(termStart, termEnd).trim());
      let next = termEnd;
      while (next < current.length && /\s/.test(current[next]!)) next += 1;
      if (current[next] === "|" && current[next + 1] === "|") {
        cursor = next;
      } else {
        current =
          current.slice(0, spanStart) +
          `CONCAT(${terms.join(", ")})` +
          current.slice(termEnd);
        break;
      }
    }
  }
  return current;
}

function replaceStrftime(sql: string, dialect: EngineDialect): string {
  const regex = /\bstrftime\s*\(\s*'([^']+)'\s*,\s*([^)]+)\)/gi;
  return sql.replace(regex, (_full, fmt: string, rawExpr: string) => {
    const expr = rawExpr.trim();
    if (dialect === "postgres") {
      const pgFmt = fmt
        .replace(/%Y/g, "YYYY")
        .replace(/%m/g, "MM")
        .replace(/%d/g, "DD")
        .replace(/%H/g, "HH24")
        .replace(/%M/g, "MI")
        .replace(/%S/g, "SS");
      return `TO_CHAR((${expr})::timestamp, '${pgFmt}')`;
    }
    if (dialect === "mysql") {
      return `DATE_FORMAT(${expr}, '${fmt}')`;
    }
    if (dialect === "tsql") {
      if (fmt === "%Y") return `CONVERT(VARCHAR(4), YEAR(TRY_CONVERT(DATE, ${expr})))`;
      if (fmt === "%m") return `RIGHT('0' + CONVERT(VARCHAR(2), MONTH(TRY_CONVERT(DATE, ${expr}))), 2)`;
      if (fmt === "%d") return `RIGHT('0' + CONVERT(VARCHAR(2), DAY(TRY_CONVERT(DATE, ${expr}))), 2)`;
      return `CONVERT(VARCHAR(10), TRY_CONVERT(DATE, ${expr}), 120)`;
    }
    return _full;
  });
}

function replaceJulianDiff(sql: string, dialect: EngineDialect): string {
  const diffRegex = /\bjulianday\s*\(\s*([^)]+)\s*\)\s*-\s*julianday\s*\(\s*([^)]+)\s*\)/gi;
  return sql.replace(diffRegex, (_full, a: string, b: string) => {
    const left = a.trim();
    const right = b.trim();
    if (dialect === "postgres") {
      return `((${left})::date - (${right})::date)`;
    }
    if (dialect === "mysql") {
      return `DATEDIFF(${left}, ${right})`;
    }
    if (dialect === "tsql") {
      return `DATEDIFF(DAY, TRY_CONVERT(DATE, ${right}), TRY_CONVERT(DATE, ${left}))`;
    }
    return _full;
  });
}

function adaptTsqlLimit(sql: string): string {
  const limitOffsetMatch = /^([\s\S]*?)\s+LIMIT\s+(\d+)\s+OFFSET\s+(\d+)\s*;?\s*$/i.exec(sql);
  if (limitOffsetMatch) {
    const body = limitOffsetMatch[1];
    const limit = limitOffsetMatch[2];
    const offset = limitOffsetMatch[3];
    if (/\bORDER\s+BY\b/i.test(body)) {
      return `${body} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
    }
    return `${body} ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
  }

  const limitOnlyMatch = /^([\s\S]*?)\s+LIMIT\s+(\d+)\s*;?\s*$/i.exec(sql);
  if (limitOnlyMatch) {
    const body = limitOnlyMatch[1];
    const limit = limitOnlyMatch[2];
    if (/\bORDER\s+BY\b/i.test(body)) {
      return `${body} OFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY`;
    }
    return body.replace(/^(\s*SELECT\s+(?:DISTINCT\s+)?)/i, `$1TOP ${limit} `);
  }
  return sql;
}

export function adaptReferenceSqlForDialect(
  sql: string,
  targetDialect: EngineDialect,
): string {
  if (targetDialect === "sqlite") return sql;

  let adapted = sql;
  adapted = replaceJulianDiff(adapted, targetDialect);
  adapted = replaceStrftime(adapted, targetDialect);
  adapted = adapted.replace(/\bdatetime\s*\(\s*'now'\s*\)/gi, runtimeTimestampExpr(targetDialect));
  adapted = adapted.replace(/\bdate\s*\(\s*'now'\s*\)/gi, runtimeDateExpr(targetDialect));
  adapted = mapOutsideStrings(adapted, (chunk) => {
    let part = chunk;
    part = part.replace(/\bIFNULL\s*\(/gi, "COALESCE(");
    part = part.replace(/\bSUBSTR\s*\(/gi, "SUBSTRING(");
    if (targetDialect === "mysql") {
      part = part.replace(/\bAS\s+INTEGER\b/gi, "AS SIGNED");
      part = part.replace(/\bAS\s+INT\b/gi, "AS SIGNED");
      part = part.replace(/\bAS\s+TEXT\b/gi, "AS CHAR");
      part = part.replace(/\bAS\s+REAL\b/gi, "AS DECIMAL(18,6)");
    } else if (targetDialect === "tsql") {
      part = part.replace(/\bAS\s+INTEGER\b/gi, "AS INT");
      part = part.replace(/\bAS\s+TEXT\b/gi, "AS NVARCHAR(MAX)");
      part = part.replace(/\bAS\s+REAL\b/gi, "AS FLOAT");
    } else if (targetDialect === "postgres") {
      part = part.replace(/\bAS\s+REAL\b/gi, "AS DOUBLE PRECISION");
    }
    return part;
  });

  if (targetDialect === "mysql") {
    adapted = rewriteConcatForMysql(adapted);
  } else if (targetDialect === "tsql") {
    adapted = mapOutsideStrings(adapted, (chunk) => chunk.replace(/\s*\|\|\s*/g, " + "));
    adapted = adaptTsqlLimit(adapted);
  }

  return adapted;
}
