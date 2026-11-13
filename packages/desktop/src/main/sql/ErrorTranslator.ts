export function translateError(message: string): string {
  const normalized = message.trim()

  if (normalized.startsWith('SQLITE_ERROR')) {
    return normalizeSqliteMessage(normalized)
  }

  if (normalized.includes('disk I/O error')) {
    return 'Database file error. Check disk permissions and available space.'
  }

  return normalized
}

function normalizeSqliteMessage(message: string): string {
  const match = message.match(/SQLITE_ERROR:\s*(.+)/i)
  if (match !== null) {
    return match[1].trim()
  }
  return message
}
