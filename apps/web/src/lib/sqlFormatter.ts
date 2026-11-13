export function formatSql(sql: string): string {
  if (!sql.trim()) return sql

  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT', 'INTO', 'VALUES',
    'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP', 'BY',
    'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'AS',
    'EXISTS', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'NOT', 'DISTINCT',
  ]

  let formatted = sql
    .replace(/;/g, ';\n')
    .replace(/\n+/g, '\n')

  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
    formatted = formatted.replace(regex, `\n${keyword}`)
  }

  // Clean up
  formatted = formatted
    .replace(/^\n/g, '')
    .replace(/\n\s*\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')

  // Indent subqueries and clauses
  const lines = formatted.split('\n')
  let indent = 0
  const result = lines.map((line) => {
    const lower = line.toLowerCase()
    if (lower.startsWith(')') || lower.startsWith('from') || lower.startsWith('where') ||
        lower.startsWith('join') || lower.startsWith('order') || lower.startsWith('group') ||
        lower.startsWith('having') || lower.startsWith('limit') || lower.startsWith('union')) {
      indent = Math.max(0, indent - 1)
    }
    const padded = '  '.repeat(indent) + line
    if (lower.endsWith('(') || lower.endsWith(',') || lower.startsWith('select') ||
        lower.startsWith('insert') || lower.startsWith('with')) {
      indent++
    }
    return padded
  })

  return result.join('\n')
}
