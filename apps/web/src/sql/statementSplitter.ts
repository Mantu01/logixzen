export interface Statement {
  sql: string
  index: number
}

export function splitStatements(sql: string): Statement[] {
  const statements: Statement[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false
  let inTransaction = false
  let i = 0

  while (i < sql.length) {
    const char = sql[i] ?? ''
    const next = sql[i + 1] ?? ''

    if (inLineComment) {
      if (char === '\n') inLineComment = false
      current += char
      i++
      continue
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') { inBlockComment = false; current += '*/'; i += 2 }
      else { current += char; i++ }
      continue
    }

    if (inSingleQuote) {
      if (char === "'" && next === "'") { current += "''"; i += 2 }
      else if (char === "'") { inSingleQuote = false; current += char; i++ }
      else { current += char; i++ }
      continue
    }

    if (inDoubleQuote) {
      if (char === '"' && next === '"') { current += '""'; i += 2 }
      else if (char === '"') { inDoubleQuote = false; current += char; i++ }
      else { current += char; i++ }
      continue
    }

    if (char === '-' && next === '-') { inLineComment = true; current += '--'; i += 2; continue }
    if (char === '/' && next === '*') { inBlockComment = true; current += '/*'; i += 2; continue }
    if (char === "'") { inSingleQuote = true; current += char; i++; continue }
    if (char === '"') { inDoubleQuote = true; current += char; i++; continue }

    if (char === ';' && !inTransaction) {
      const trimmed = current.trim()
      if (trimmed.length > 0) statements.push({ sql: trimmed, index: statements.length })
      current = ''
      i++
      continue
    }

    if (char.toUpperCase() === 'B' && sql.slice(i, i + 7).toUpperCase() === 'BEGIN') { inTransaction = true; current += 'BEGIN'; i += 5; continue }
    if (char.toUpperCase() === 'C' && sql.slice(i, i + 6).toUpperCase() === 'COMMIT') { inTransaction = false; current += 'COMMIT'; i += 6; continue }
    if (char.toUpperCase() === 'R' && sql.slice(i, i + 8).toUpperCase() === 'ROLLBACK') { inTransaction = false; current += 'ROLLBACK'; i += 8; continue }

    current += char
    i++
  }

  const lastTrimmed = current.trim()
  if (lastTrimmed.length > 0) statements.push({ sql: lastTrimmed, index: statements.length })
  return statements
}
