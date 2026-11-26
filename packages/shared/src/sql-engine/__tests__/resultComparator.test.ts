import { compareResults } from '../resultComparator'
import type { SqlResult } from '../types'

function makeResult(columns: string[], rows: Record<string, unknown>[]): SqlResult {
  return {
    columns,
    rows,
    rowsAffected: 0,
    isSelect: true,
    statementIndex: 0,
    executionTimeMs: 0,
  }
}

describe('compareResults', () => {
  test('matches rows when columnNamesMatter is false and aliases differ', () => {
    const actual = makeResult(['cnt'], [{ cnt: 5 }])
    const expected = makeResult(['total_users'], [{ total_users: 5 }])
    const res = compareResults(actual, expected, { columnNamesMatter: false })
    expect(res.match).toBe(true)
  })

  test('fails when columnNamesMatter is true and aliases differ', () => {
    const actual = makeResult(['cnt'], [{ cnt: 5 }])
    const expected = makeResult(['total_users'], [{ total_users: 5 }])
    const res = compareResults(actual, expected, { columnNamesMatter: true })
    expect(res.match).toBe(false)
  })

  test('sorts numerically rather than lexicographically when orderMatters is false', () => {
    const actual = makeResult(['id'], [{ id: 10 }, { id: 2 }, { id: 1 }])
    const expected = makeResult(['id'], [{ id: 1 }, { id: 2 }, { id: 10 }])
    const res = compareResults(actual, expected, { orderMatters: false })
    expect(res.match).toBe(true)
  })

  test('compares floats within floatTolerance', () => {
    const actual = makeResult(['avg_val'], [{ avg_val: 3.14159 }])
    const expected = makeResult(['avg_val'], [{ avg_val: 3.1419 }])
    const res = compareResults(actual, expected, { floatTolerance: 0.001 })
    expect(res.match).toBe(true)
  })

  test('handles case-insensitive string comparison when configured', () => {
    const actual = makeResult(['name'], [{ name: 'Alice' }])
    const expected = makeResult(['name'], [{ name: 'alice' }])
    expect(compareResults(actual, expected, { caseSensitiveStrings: false }).match).toBe(true)
    expect(compareResults(actual, expected, { caseSensitiveStrings: true }).match).toBe(false)
  })

  test('handles nulls cleanly', () => {
    const actual = makeResult(['v'], [{ v: null }])
    const expected = makeResult(['v'], [{ v: null }])
    expect(compareResults(actual, expected).match).toBe(true)
    const diff = makeResult(['v'], [{ v: 'x' }])
    expect(compareResults(actual, diff).match).toBe(false)
  })
})
