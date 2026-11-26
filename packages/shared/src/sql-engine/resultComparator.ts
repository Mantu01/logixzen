import type { SqlResult, SqlRow } from './types'

export interface CompareOptions {
  orderMatters: boolean
  columnNamesMatter: boolean
  floatTolerance: number
  caseSensitiveStrings: boolean
}

const DEFAULT_OPTIONS: CompareOptions = {
  orderMatters: true,
  columnNamesMatter: false,
  floatTolerance: 0.001,
  caseSensitiveStrings: true,
}

export function compareResults(
  actual: SqlResult,
  expected: SqlResult,
  options: Partial<CompareOptions> = {}
): { match: boolean; message: string; differences?: { missingRows?: SqlRow[]; extraRows?: SqlRow[]; firstMismatch?: { position: number; expected: SqlRow; actual: SqlRow } } } {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  if (actual.columns.length !== expected.columns.length) {
    return {
      match: false,
      message: `Column count mismatch: expected ${expected.columns.length}, got ${actual.columns.length}`,
    }
  }

  if (opts.columnNamesMatter) {
    const missingCol = expected.columns.find((col) => !actual.columns.includes(col))
    if (missingCol !== undefined) {
      return {
        match: false,
        message: `Column mismatch: expected column "${missingCol}"`,
      }
    }
  }

  if (actual.rows.length !== expected.rows.length) {
    return {
      match: false,
      message: `Row count mismatch: expected ${expected.rows.length}, got ${actual.rows.length}`,
      differences: {
        missingRows: expected.rows,
        extraRows: actual.rows,
      },
    }
  }

  const actualRows = opts.orderMatters ? actual.rows : sortRows(actual.rows, actual.columns, opts)
  const expectedRows = opts.orderMatters ? expected.rows : sortRows(expected.rows, expected.columns, opts)

  for (let i = 0; i < actualRows.length; i++) {
    const actualRow = normalizeRow(actualRows[i] ?? {}, opts)
    const expectedRow = normalizeRow(expectedRows[i] ?? {}, opts)
    if (!rowsEqual(actualRow, expectedRow, actual.columns, expected.columns, opts)) {
      return {
        match: false,
        message: `Row ${i + 1} mismatch`,
        differences: {
          firstMismatch: { position: i, expected: expectedRows[i] ?? {}, actual: actualRows[i] ?? {} },
        },
      }
    }
  }

  return { match: true, message: 'Results match' }
}

function rowColumns(row: SqlRow, columns: string[]): string[] {
  return columns.length > 0 ? columns : Object.keys(row)
}

function sortRows(rows: SqlRow[], columns: string[], opts: CompareOptions): SqlRow[] {
  return rows.slice().sort((a, b) => {
    const keysA = opts.columnNamesMatter ? rowColumns(a, columns).slice().sort() : rowColumns(a, columns)
    const keysB = opts.columnNamesMatter ? rowColumns(b, columns).slice().sort() : rowColumns(b, columns)
    for (let i = 0; i < Math.min(keysA.length, keysB.length); i++) {
      const aKey = keysA[i]
      const bKey = keysB[i]
      if (!aKey || !bKey) continue
      const aVal = a[aKey]
      const bVal = b[bKey]
      if (aVal === undefined && bVal === undefined) continue
      if (aVal === undefined) return 1
      if (bVal === undefined) return -1
      const cmp = compareValues(aVal, bVal, opts)
      if (cmp !== 0) return cmp
    }
    return keysA.length - keysB.length
  })
}

function normalizeRow(row: SqlRow, opts: CompareOptions): SqlRow {
  const normalized: SqlRow = {}
  for (const key of Object.keys(row)) {
    const val = row[key ?? '']
    if (val !== undefined) normalized[key] = normalizeValue(val, opts)
  }
  return normalized
}

function toFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (trimmed.length === 0) return null
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function compareValues(a: unknown, b: unknown, opts: CompareOptions): number {
  if (a === null && b === null) return 0
  if (a === null) return -1
  if (b === null) return 1
  const numA = toFiniteNumber(a)
  const numB = toFiniteNumber(b)
  if (numA !== null && numB !== null) {
    if (Math.abs(numA - numB) <= opts.floatTolerance) return 0
    return numA - numB
  }
  const aStr = opts.caseSensitiveStrings ? String(a) : String(a).toLowerCase()
  const bStr = opts.caseSensitiveStrings ? String(b) : String(b).toLowerCase()
  if (aStr < bStr) return -1
  if (aStr > bStr) return 1
  return 0
}

function normalizeValue(value: unknown, opts: CompareOptions): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || opts.floatTolerance <= 0) return value
    return Math.round(value / opts.floatTolerance) * opts.floatTolerance
  }
  if (typeof value === 'string' && !opts.caseSensitiveStrings) return value.toLowerCase()
  return value
}

function rowsEqual(
  a: SqlRow,
  b: SqlRow,
  aCols: string[],
  bCols: string[],
  opts: CompareOptions
): boolean {
  if (!opts.columnNamesMatter) {
    const keysA = rowColumns(a, aCols)
    const keysB = rowColumns(b, bCols)
    if (keysA.length !== keysB.length) return false
    for (let i = 0; i < keysA.length; i++) {
      const aVal = a[keysA[i] ?? ''] ?? null
      const bVal = b[keysB[i] ?? ''] ?? null
      if (!valuesEqual(aVal, bVal, opts)) return false
    }
    return true
  }

  const aKeys = Object.keys(a).sort()
  const bKeys = Object.keys(b).sort()
  if (aKeys.length !== bKeys.length) return false
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false
    const aVal = a[aKeys[i] ?? '']
    const bVal = b[bKeys[i] ?? '']
    if (aVal === undefined && bVal === undefined) continue
    if (!valuesEqual(aVal ?? null, bVal ?? null, opts)) return false
  }
  return true
}

function valuesEqual(a: unknown, b: unknown, opts: CompareOptions): boolean {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  const numA = toFiniteNumber(a)
  const numB = toFiniteNumber(b)
  if (numA !== null && numB !== null) {
    return Math.abs(numA - numB) <= opts.floatTolerance
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return String(a).toLowerCase() === String(b).toLowerCase()
  }
  const aStr = String(a)
  const bStr = String(b)
  return opts.caseSensitiveStrings ? aStr === bStr : aStr.toLowerCase() === bStr.toLowerCase()
}
