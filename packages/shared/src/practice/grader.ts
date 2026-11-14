import { compareResults } from '../sql-engine/resultComparator'
import type { SqlResult, SqlRow } from '../sql-engine/types'
import type { Question, TestCase, Dataset, ValidationConfig } from '../content/schemas'

export interface GradeResult {
  passed: boolean
  score: number
  feedback: string
  testResults: TestCaseResult[]
  hintsUsed: number
}

export interface TestCaseResult {
  id: string
  passed: boolean
  description?: string
  message?: string
}

export interface TechniqueCheck {
  technique: string
  required: boolean
  found: boolean
}


export function detectTechnique(sql: string, technique: string): boolean {
  const patterns: Record<string, RegExp> = {
    JOIN: /\bJOIN\b/i,
    'INNER JOIN': /\bINNER\s+JOIN\b/i,
    'LEFT JOIN': /\bLEFT\s+(OUTER\s+)?JOIN\b/i,
    'RIGHT JOIN': /\bRIGHT\s+(OUTER\s+)?JOIN\b/i,
    'GROUP BY': /\bGROUP\s+BY\b/i,
    'ORDER BY': /\bORDER\s+BY\b/i,
    'HAVING': /\bHAVING\b/i,
    'WHERE': /\bWHERE\b/i,
    'DISTINCT': /\bDISTINCT\b/i,
    'SUBQUERY': /\(\s*SELECT\b/i,
    CTE: /\bWITH\b.*\bAS\s*\(/i,
    'COUNT': /\bCOUNT\s*\(/i,
    'SUM': /\bSUM\s*\(/i,
    'AVG': /\bAVG\s*\(/i,
    'MAX': /\bMAX\s*\(/i,
    'MIN': /\bMIN\s*\(/i,
    'INSERT': /\bINSERT\s+INTO\b/i,
    'UPDATE': /\bUPDATE\b/i,
    'DELETE': /\bDELETE\s+FROM\b/i,
  }
  const pattern = patterns[technique.toUpperCase()] ?? new RegExp('\\b' + technique + '\\b', 'i')
  return pattern.test(sql)
}

export function checkTechniques(
  sql: string,
  required?: string[],
  forbidden?: string[]
): { passed: boolean; details: TechniqueCheck[]; message: string } {
  const details: TechniqueCheck[] = []

  for (const t of (required ?? [])) {
    const found = detectTechnique(sql, t)
    details.push({ technique: t, required: true, found })
  }

  for (const t of (forbidden ?? [])) {
    const found = detectTechnique(sql, t)
    details.push({ technique: t, required: false, found })
  }

  const allCompliant = details.every((r) => r.required ? r.found : !r.found)
  const missingRequired = details.filter((r) => r.required && !r.found).map((r) => r.technique)
  const usedForbidden = details.filter((r) => !r.required && r.found).map((r) => r.technique)

  let message = ''
  if (missingRequired.length > 0) message += `Missing required: ${missingRequired.join(', ')}. `
  if (usedForbidden.length > 0) message += `Forbidden technique used: ${usedForbidden.join(', ')}. `
  if (message === '') message = 'All technique requirements met'

  return { passed: allCompliant, details, message }
}

export async function gradeQuestion(
  studentSql: string,
  question: Question,
  dataset: Dataset,
  engine: { execute: (sql: string) => Promise<SqlResult[]> }
): Promise<GradeResult> {
  const results: TestCaseResult[] = []
  const validation = question.validation as ValidationConfig

  try {
    await executeSql(engine, dataset.setupSql)

    for (const tc of (question as Question & { testCases?: TestCase[] }).testCases ?? []) {
      const tcResult = await evaluateTestCase(engine, tc, question, validation, studentSql)
      results.push(tcResult)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    for (const tc of (question as Question & { testCases?: TestCase[] }).testCases ?? []) {
      results.push({
        id: tc.id,
        passed: false,
        message: `Setup error: ${errorMessage}`,
      })
    }
  }

  const visibleResults = results.filter((r) => !((question as Question & { testCases?: TestCase[] }).testCases ?? []).find((tc) => tc.id === r.id)?.hidden)
  const allPassed = visibleResults.every((r) => r.passed)
  const failedVisible = visibleResults.filter((r) => !r.passed)

  const feedback =
    allPassed
      ? 'Correct! All test cases passed.'
      : failedVisible.length > 0
        ? failedVisible[0]!.message ?? 'Incorrect result.'
        : 'Incorrect. Try again.'

  let techniqueMessage = ''
  if ('requiredTechniques' in validation && validation.requiredTechniques) {
    const techCheck = checkTechniques(studentSql, validation.requiredTechniques, validation.forbiddenTechniques)
    if (!techCheck.passed) {
      techniqueMessage = techCheck.message
    }
  }

  return {
    passed: allPassed && techniqueMessage === '',
    score: allPassed ? question.points : 0,
    feedback: techniqueMessage || feedback,
    testResults: results,
    hintsUsed: 0,
  }
}

async function evaluateTestCase(
  engine: { execute: (sql: string) => Promise<SqlResult[]> },
  tc: TestCase,
  question: Question,
  validation: ValidationConfig,
  studentSql: string
): Promise<TestCaseResult> {
  if (question.type === 'mcq-single' || question.type === 'mcq-multi') {
    return { id: tc.id, passed: true }
  }

  if (tc.expected.type === 'fromSolution') {
    if (!('solutionSql' in question) || (question as Question & { solutionSql?: string }).solutionSql === undefined) {
      return { id: tc.id, passed: false, message: 'No reference solution available' }
    }
    try {
      const expectedResult = await executeSql(engine, (question as Question & { solutionSql: string }).solutionSql)
      const actualResult = await executeSql(engine, studentSql)
      const comparison = compareResults(actualResult, expectedResult, {
        orderMatters: validation.orderMatters ?? true,
        columnNamesMatter: validation.columnNamesMatter ?? false,
        floatTolerance: validation.floatTolerance ?? 0.001,
        caseSensitiveStrings: validation.caseSensitiveStrings ?? false,
      })
      return {
        id: tc.id,
        passed: comparison.match,
        message: comparison.match ? undefined : comparison.message,
      }
    } catch (error) {
      return { id: tc.id, passed: false, message: String(error) }
    }
  }

  if (tc.expected.type === 'literal') {
    try {
      const actualResult = await executeSql(engine, studentSql)

      const actualNormalized = normalizeResult(actualResult)
      const expectedNormalized = normalizeLiteralResult(tc.expected)

      const match = compareResults(actualNormalized, expectedNormalized, {
        orderMatters: validation.orderMatters ?? true,
        columnNamesMatter: validation.columnNamesMatter ?? true,
      })
      return {
        id: tc.id,
        passed: match.match,
        message: match.message,
      }
    } catch (error) {
      return { id: tc.id, passed: false, message: String(error) }
    }
  }

  return { id: tc.id, passed: false, message: 'Unknown expected type' }
}

function normalizeResult(result: SqlResult): SqlResult {
  return {
    columns: result.columns,
    rows: result.rows,
    rowsAffected: result.rowsAffected,
    statementIndex: result.statementIndex,
    isSelect: result.isSelect,
    executionTimeMs: result.executionTimeMs,
  }
}

function normalizeLiteralResult(expected: { type: 'literal'; columns: string[]; rows: unknown[][] }): SqlResult {
  const rows: SqlRow[] = expected.rows.map((row) => {
    const rowObj: SqlRow = {}
    expected.columns.forEach((col, i) => {
      const val = row[i]
      if (val !== undefined) rowObj[col] = val
    })
    return rowObj
  })
  return {
    columns: expected.columns,
    rows,
    rowsAffected: 0,
    statementIndex: 0,
    isSelect: true,
    executionTimeMs: 0,
  }
}

async function executeSql(
  engine: { execute: (sql: string) => Promise<SqlResult[]> },
  sql: string
): Promise<SqlResult> {
  const results = await engine.execute(sql)
  return results[0] ?? {
    columns: [],
    rows: [],
    rowsAffected: 0,
    statementIndex: 0,
    isSelect: false,
    executionTimeMs: 0,
  }
}
