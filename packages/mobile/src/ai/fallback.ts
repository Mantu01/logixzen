import type { Question } from '@logixzen/shared/content'

// Static fallback hints — used when AI is unavailable
export function buildStaticHint(question: Question, index: number): string {
  return question.hints?.[index]?.text ?? 'Review the question requirements carefully.'
}

export function buildStaticErrorMessage(error: string, question: Question): string {
  const msg = error.toLowerCase()
  if (msg.includes('syntax')) return 'Syntax error in SQL. Check for missing commas, brackets, or keywords.'
  if (msg.includes('no such table')) return 'Table not found. Verify the table name matches the dataset schema.'
  if (msg.includes('column')) return 'Column reference error. Check column names against the schema.'
  if (msg.includes('undefined')) return 'Invalid SQL expression. Verify your query syntax.'
  return `Query error: ${error}`
}

export function buildStaticExplanation(question: Question): string {
  return question.explanation ?? 'Review the question requirements and try again.'
}
