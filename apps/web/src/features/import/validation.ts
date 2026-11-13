import type { ValidationResult } from '@logixzen/shared/content'

export type ImportSource = 'sql-file' | 'csv-file' | 'sqlite-file' | 'json-paste' | 'json-file'
export type ImportTarget = 'database' | 'questions' | 'progress'

export interface ImportResult {
  success: boolean
  validation: ValidationResult
  importedItems: number
}

export function validateJSONContent(content: string): ValidationResult {
  try {
    JSON.parse(content)
    return { valid: true, errors: [] }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON'
    return { valid: false, errors: [{ type: 'parse-error', path: '', message }] }
  }
}

export function validateSQLContent(content: string): ValidationResult {
  const errors: { type: string; path: string; message: string }[] = []

  if (content.length === 0) {
    return { valid: false, errors: [{ type: 'empty-content', path: '', message: 'SQL content is empty' }] }
  }

  if (content.length > 10_000_000) {
    errors.push({ type: 'oversized', path: '', message: 'SQL content exceeds 10MB limit' })
  }

  const forbiddenPatterns = [
    { pattern: /\bATTACH\s+/i, message: 'ATTACH DATABASE is forbidden' },
    { pattern: /\bDETACH\s+/i, message: 'DETACH DATABASE is forbidden' },
    { pattern: /\bLOAD_EXTENSION\s+/i, message: 'LOAD_EXTENSION is forbidden' },
  ]

  for (const { pattern, message } of forbiddenPatterns) {
    if (pattern.test(content)) {
      errors.push({ type: 'unsafe-content', path: '', message })
    }
  }

  return { valid: errors.length === 0, errors }
}

export function validateCSVContent(content: string): ValidationResult {
  const errors: { type: string; path: string; message: string }[] = []

  if (content.length === 0) {
    return { valid: false, errors: [{ type: 'empty-content', path: '', message: 'CSV content is empty' }] }
  }

  const lines = content.split('\n').filter((line) => line.trim().length > 0)
  if (lines.length === 0) {
    return { valid: false, errors: [{ type: 'empty-content', path: '', message: 'CSV has no data rows' }] }
  }

  if (lines.length > 100_000) {
    errors.push({ type: 'oversized', path: '', message: 'CSV exceeds 100,000 rows limit' })
  }

  return { valid: errors.length === 0, errors }
}

export function validateProgressJSON(content: string): ValidationResult {
  const jsonValidation = validateJSONContent(content)
  if (!jsonValidation.valid) {
    return jsonValidation
  }

  try {
    const parsed = JSON.parse(content)
    const requiredFields = ['solvedQuestions', 'totalPoints', 'streak']
    const missingFields = requiredFields.filter((field) => !(field in parsed))

    if (missingFields.length > 0) {
      return {
        valid: false,
        errors: missingFields.map((field) => ({
          type: 'missing-field',
          path: field,
          message: `Missing required field: ${field}`,
        })),
      }
    }

    return { valid: true, errors: [] }
  } catch {
    return { valid: false, errors: [{ type: 'invalid-format', path: '', message: 'Progress data has invalid format' }] }
  }
}

export function validateContent(
  source: ImportSource,
  target: ImportTarget,
  content: string
): ValidationResult {
  if (target === 'progress') {
    return validateProgressJSON(content)
  }

  if (source === 'json-paste' || source === 'json-file') {
    return validateJSONContent(content)
  }

  if (source === 'sql-file') {
    return validateSQLContent(content)
  }

  if (source === 'csv-file') {
    return validateCSVContent(content)
  }

  return { valid: true, errors: [] }
}
