import type { Dataset, Topic, Question, ValidationResult, ValidationError } from './schemas'

const FORBIDDEN_PATTERNS = [
  { pattern: /\bATTACH\s+/i, risk: 'high' as const, message: 'ATTACH DATABASE is forbidden' },
  { pattern: /\bDETACH\s+/i, risk: 'high' as const, message: 'DETACH DATABASE is forbidden' },
  { pattern: /\bLOAD_EXTENSION\s+/i, risk: 'high' as const, message: 'LOAD_EXTENSION is forbidden' },
  { pattern: /\bIMPORT\s+/i, risk: 'high' as const, message: 'IMPORT is forbidden' },
  { pattern: /<script/i, risk: 'high' as const, message: 'Script tags are forbidden' },
  { pattern: /javascript:/i, risk: 'high' as const, message: 'JavaScript protocol is forbidden' },
]

export function checkSafety(sql: string): ValidationResult {
  const errors: ValidationError[] = []

  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    if (pattern.test(sql)) {
      errors.push({ type: 'unsafe-content', path: 'setupSql', message })
    }
  }

  const insertCount = (sql.match(/\bINSERT\s+INTO\b/gi) || []).length
  if (insertCount > 10000) {
    errors.push({
      type: 'oversized-dataset',
      path: 'setupSql',
      message: `Dataset contains ${insertCount} INSERT statements (max 10000)`,
    })
  }

  return { valid: errors.length === 0, errors }
}

export function validateConsistency(
  questions: Question[],
  datasets: Dataset[],
  topics: Topic[]
): ValidationResult {
  const errors: ValidationError[] = []
  const datasetIds = new Set(datasets.map((d) => d.id))
  const topicIds = new Set(topics.map((t) => t.id))
  const seenIds = new Set<string>()

  for (const q of questions) {
    if (!datasetIds.has(q.datasetId)) {
      errors.push({
        type: 'invalid-dataset-reference',
        path: `questions[${questions.indexOf(q)}].datasetId`,
        message: `Question "${q.id}" references non-existent dataset "${q.datasetId}"`,
        suggestion: `Available datasets: ${[...datasetIds].join(', ')}`,
      })
    }

    if (!topicIds.has(q.topicId)) {
      errors.push({
        type: 'invalid-topic-reference',
        path: `questions[${questions.indexOf(q)}].topicId`,
        message: `Question "${q.id}" references non-existent topic "${q.topicId}"`,
        suggestion: `Available topics: ${[...topicIds].join(', ')}`,
      })
    }

    if (seenIds.has(q.id)) {
      errors.push({
        type: 'duplicate-id',
        path: `questions[${questions.indexOf(q)}].id`,
        message: `Duplicate question ID: "${q.id}"`,
      })
    }
    seenIds.add(q.id)

    if (q.type === 'mcq-single' && 'correctOptionId' in q) {
      const optionIds = new Set((q as { options?: Array<{ id: string }> }).options?.map((o) => o.id) ?? [])
      if (!optionIds.has(q.correctOptionId)) {
        errors.push({
          type: 'invalid-mcq-answer',
          path: `questions[${questions.indexOf(q)}].correctOptionId`,
          message: `MCQ answer "${q.correctOptionId}" does not match any option`,
        })
      }
    }

    if (q.type === 'mcq-multi' && 'correctOptionIds' in q) {
      const validIds = new Set((q as { options?: Array<{ id: string }> }).options?.map((o) => o.id) ?? [])
      const invalid = (q as { correctOptionIds?: string[] }).correctOptionIds?.filter((id) => !validIds.has(id))
      if (invalid !== undefined && invalid.length > 0) {
        errors.push({
          type: 'invalid-mcq-multi-answers',
          path: `questions[${questions.indexOf(q)}].correctOptionIds`,
          message: `Invalid MCQ multi answers: ${invalid.join(', ')}`,
        })
      }
    }

    if (q.type === 'fill-blank' && 'blankTemplate' in q && 'acceptedAnswers' in q) {
      const blankCount = ((q as { blankTemplate: string }).blankTemplate.match(/___/g) || []).length
      const answerCount = Object.keys((q as { acceptedAnswers: Record<string, string[]> }).acceptedAnswers).length
      if (blankCount !== answerCount) {
        errors.push({
          type: 'mismatched-blanks',
          path: `questions[${questions.indexOf(q)}]`,
          message: `Template has ${blankCount} blanks but ${answerCount} accepted answers defined`,
        })
      }
    }
  }

  const topicQuestionMap = new Map<string, number>()
  for (const q of questions) {
    topicQuestionMap.set(q.topicId, (topicQuestionMap.get(q.topicId) ?? 0) + 1)
  }
  for (const topic of topics) {
    if (!topicQuestionMap.has(topic.id)) {
      errors.push({
        type: 'orphan-topic',
        path: `topics[${topics.indexOf(topic)}].id`,
        message: `Topic "${topic.id}" has no questions`,
      })
    }
  }

  return { valid: errors.length === 0, errors }
}
