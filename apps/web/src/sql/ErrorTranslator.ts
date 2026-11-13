const TRANSLATIONS: Array<{
  pattern: RegExp
  message: string
  suggestion?: (match: string[]) => string
}> = [
  { pattern: /no such table:\s*(\w+)/i, message: 'Table not found. Check spelling or explore the schema.', suggestion: (match) => `Did you mean "${match[1]}"?` },
  { pattern: /no such column:\s*(\w+)/i, message: 'Column not found. Check spelling or explore the schema.', suggestion: (match) => `Did you mean "${match[1]}"?` },
  { pattern: /ambiguous column name:\s*(\w+)/i, message: 'Multiple tables have this column. Use "table.column" syntax.' },
  { pattern: /constraint failed/i, message: 'Data violates a rule (e.g., duplicate primary key).' },
  { pattern: /near "([^"]+)":\s*syntax error/i, message: 'Syntax error near the highlighted token.' },
]

export function translateError(rawMessage: string): string {
  for (const { pattern, message, suggestion } of TRANSLATIONS) {
    const match = pattern.exec(rawMessage)
    if (match !== null) {
      if (suggestion !== undefined) return `${message} ${suggestion(match.slice(1))}`
      return message
    }
  }
  return rawMessage
}

export function isSafeStatement(sql: string): boolean {
  const FORBIDDEN = ['ATTACH', 'DETACH', 'DROP DATABASE', 'LOAD_EXTENSION', 'CREATE VIRTUAL TABLE', 'IMPORT']
  const trimmed = sql.trim().toUpperCase()
  return !FORBIDDEN.some((stmt) => trimmed.startsWith(stmt))
}
