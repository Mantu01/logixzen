export interface Statement {
  sql: string
  index: number
}

export function splitStatements(sql: string): Statement[] {
  const statements: Statement[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inBacktick = false
  let inBrackets = false
  let dollarTag: string | null = null
  let inLineComment = false
  let inBlockComment = false
  let inTransaction = false
  let isTrigger = false
  let triggerDepth = 0
  let i = 0

  while (i < sql.length) {
    const char = sql[i]!
    const next = sql[i + 1]

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false
        current += char
      }
      i++
      continue
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        current += '*/'
        i += 2
      } else {
        current += char
        i++
      }
      continue
    }

    if (dollarTag !== null) {
      if (char === '$' && sql.slice(i).startsWith(dollarTag)) {
        current += dollarTag
        i += dollarTag.length
        dollarTag = null
      } else {
        current += char
        i++
      }
      continue
    }

    if (inSingleQuote) {
      if (char === "'" && next === "'") {
        current += "''"
        i += 2
      } else if (char === '\\' && next !== undefined) {
        current += char + next
        i += 2
      } else if (char === "'") {
        inSingleQuote = false
        current += char
        i++
      } else {
        current += char
        i++
      }
      continue
    }

    if (inDoubleQuote) {
      if (char === '"' && next === '"') {
        current += '""'
        i += 2
      } else if (char === '"') {
        inDoubleQuote = false
        current += char
        i++
      } else {
        current += char
        i++
      }
      continue
    }

    if (inBacktick) {
      if (char === '`' && next === '`') {
        current += '``'
        i += 2
      } else if (char === '`') {
        inBacktick = false
        current += char
        i++
      } else {
        current += char
        i++
      }
      continue
    }

    if (inBrackets) {
      if (char === ']' && next === ']') {
        current += ']]'
        i += 2
      } else if (char === ']') {
        inBrackets = false
        current += char
        i++
      } else {
        current += char
        i++
      }
      continue
    }

    if (char === '-' && next === '-') {
      inLineComment = true
      current += '--'
      i += 2
      continue
    }

    if (char === '/' && next === '*') {
      inBlockComment = true
      current += '/*'
      i += 2
      continue
    }

    if (char === '$') {
      const match = /^\$([a-zA-Z0-9_]*)\$/.exec(sql.slice(i))
      if (match !== null) {
        dollarTag = match[0]
        current += dollarTag
        i += dollarTag.length
        continue
      }
    }

    if (char === "'") {
      inSingleQuote = true
      current += char
      i++
      continue
    }

    if (char === '"') {
      inDoubleQuote = true
      current += char
      i++
      continue
    }

    if (char === '`') {
      inBacktick = true
      current += char
      i++
      continue
    }

    if (char === '[') {
      inBrackets = true
      current += char
      i++
      continue
    }

    const tailUpper = sql.slice(i).toUpperCase()
    if (/^CREATE\s+(?:TEMP\s+|TEMPORARY\s+)?TRIGGER\b/.test(tailUpper)) {
      isTrigger = true
    }
    if (isTrigger) {
      if (/^BEGIN\b/.test(tailUpper) && (i === 0 || !/[A-Z0-9_]/i.test(sql[i - 1] ?? ''))) {
        triggerDepth += 1
      } else if (/^END\b/.test(tailUpper) && (i === 0 || !/[A-Z0-9_]/i.test(sql[i - 1] ?? ''))) {
        triggerDepth = Math.max(0, triggerDepth - 1)
      }
    }

    if (char === ';' && !inTransaction && !(isTrigger && triggerDepth > 0)) {
      const trimmed = current.trim()
      if (trimmed.length > 0) {
        statements.push({ sql: trimmed, index: statements.length })
      }
      current = ''
      isTrigger = false
      triggerDepth = 0
      i++
      continue
    }

    if (!isTrigger && char.toUpperCase() === 'B' && /^BEGIN\b/i.test(sql.slice(i))) {
      if (i === 0 || !/[A-Z0-9_]/i.test(sql[i - 1] ?? '')) {
        inTransaction = true
        current += 'BEGIN'
        i += 5
        continue
      }
    }

    if (!isTrigger && char.toUpperCase() === 'C' && /^COMMIT\b/i.test(sql.slice(i))) {
      if (i === 0 || !/[A-Z0-9_]/i.test(sql[i - 1] ?? '')) {
        inTransaction = false
        current += 'COMMIT'
        i += 6
        continue
      }
    }

    if (!isTrigger && char.toUpperCase() === 'R' && /^ROLLBACK\b/i.test(sql.slice(i))) {
      if (i === 0 || !/[A-Z0-9_]/i.test(sql[i - 1] ?? '')) {
        inTransaction = false
        current += 'ROLLBACK'
        i += 8
        continue
      }
    }

    current += char
    i++
  }

  const lastTrimmed = current.trim()
  if (lastTrimmed.length > 0) {
    statements.push({ sql: lastTrimmed, index: statements.length })
  }

  return statements
}
