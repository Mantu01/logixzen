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
  const actualRows = opts.orderMatters ? actual.rows : sortRows(actual.rows, opts)
  const expectedRows = opts.orderMatters ? expected.rows : sortRows(expected.rows, opts)

  if (actualRows.length !== expectedRows.length) {
    return {
      match: false,
      message: `Row count mismatch: expected ${expectedRows.length}, got ${actualRows.length}`,
      differences: {
        missingRows: expectedRows,
        extraRows: actualRows,
      },
    }
  }

  if (!opts.columnNamesMatter) {
    const actualCols = new Set(actual.columns)
    const expectedCols = new Set(expected.columns)
    if (actualCols.size !== expectedCols.size) {
      return { match: false, message: 'Column count mismatch' }
    }
  }

  for (let i = 0; i < actualRows.length; i++) {
    const actualRow = normalizeRow(actualRows[i] ?? {}, opts)
    const expectedRow = normalizeRow(expectedRows[i] ?? {}, opts)
    if (!rowsEqual(actualRow, expectedRow, opts)) {
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

function sortRows(rows: SqlRow[], opts: CompareOptions): SqlRow[] {
  return rows.slice().sort((a, b) => {
    const aKeys = Object.keys(a).sort()
    const bKeys = Object.keys(b).sort()
    for (let i = 0; i < Math.min(aKeys.length, bKeys.length); i++) {
      const aKey = aKeys[i]
      const bKey = bKeys[i]
      if (!aKey || !bKey) continue
      const aVal = a[aKey]
      const bVal = b[bKey]
      if (aVal === undefined && bVal === undefined) continue
      if (aVal === undefined) return 1
      if (bVal === undefined) return -1
      const cmp = compareValues(aVal, bVal, opts)
      if (cmp !== 0) return cmp
    }
    return aKeys.length - bKeys.length
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

function compareValues(a: unknown, b: unknown, _opts: CompareOptions): number {
  if (a === null && b === null) return 0
  if (a === null) return -1
  if (b === null) return 1
  const aStr = String(a)
  const bStr = String(b)
  if (aStr < bStr) return -1
  if (aStr > bStr) return 1
  return 0
}

function normalizeValue(value: unknown, opts: CompareOptions): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'number') return Math.round(value / opts.floatTolerance) * opts.floatTolerance
  if (typeof value === 'string' && !opts.caseSensitiveStrings) return value.toLowerCase()
  return value
}


function rowsEqual(a: SqlRow, b: SqlRow, opts: CompareOptions): boolean {
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
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= opts.floatTolerance
  }
  const aStr = String(a)
  const bStr = String(b)
  return opts.caseSensitiveStrings ? aStr === bStr : aStr.toLowerCase() === bStr.toLowerCase()
}

