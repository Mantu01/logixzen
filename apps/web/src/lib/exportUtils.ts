import type { SqlResult } from '@logixzen/shared/sql-engine'

export function exportToCsv(result: SqlResult): string {
  if (result.columns.length === 0) return ''
  const header = result.columns.join(',')
  const rows = result.rows.map((row) =>
    result.columns.map((col) => {
      const val = String(row[col] ?? '')
      return val.includes(',') ? `"${val}"` : val
    }).join(',')
  )
  return [header, ...rows].join('\n')
}

export function exportToJson(result: SqlResult): string {
  return JSON.stringify(result.rows, null, 2)
}

export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
