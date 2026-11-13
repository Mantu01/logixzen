import type { Question } from '@logixzen/shared/content'

interface CommonRequest {
  question?: Question
  sql?: string
  topicId?: string
  privacySettings: {
    sendSchemaOnly: boolean
    sendHistory: boolean
    sendProgress: boolean
  }
}

export interface HintRequest extends CommonRequest {
  currentHintIndex: number
  studentAttemptCount: number
}

export interface ErrorExplanationRequest extends CommonRequest {
  errorMessage: string
}

export interface QueryExplanationRequest extends CommonRequest {
  result: unknown
}

export interface AlternativeQueryRequest extends CommonRequest {
  studentAnswer: string
}

export interface AlternativeQuery {
  sql: string
  explanation: string
}

export function buildHintPrompt(request: HintRequest): string {
  const { question, currentHintIndex, studentAttemptCount } = request

  if (!question) {
    return 'I need a question object to generate a hint.'
  }

  const hintContext = currentHintIndex > 0
    ? `\nThe user has already seen ${currentHintIndex} hint(s):\n${question.hints.slice(0, currentHintIndex).map((h, i) => `Hint ${i + 1}: ${h}`).join('\n')}`
    : ''

  return `You are a helpful SQL tutor. The student is working on this question:

Title: ${question.title}
Difficulty: ${question.difficulty}
Description: ${question.description}
Hints available: ${question.hints.length}

${hintContext}

The student has made ${studentAttemptCount} attempt(s). Generate the NEXT hint (hint ${currentHintIndex + 1}) that:
1. Is not too obvious
2. Guides without giving away the answer
3. Is encouraging and supportive

Output ONLY the hint text, nothing else.`
}

export function buildErrorExplanationPrompt(request: ErrorExplanationRequest): string {
  const { question, sql, errorMessage } = request

  return `You are a helpful SQL tutor. The student got an error running their query.

Question: ${question?.title ?? 'Unknown'}
Student's SQL: ${sql ?? 'N/A'}
Error: ${errorMessage ?? 'N/A'}

Explain the error in simple terms and suggest how to fix it. Keep the explanation under 3 sentences.`
}

export function buildQueryExplanationPrompt(request: QueryExplanationRequest): string {
  const { question, sql } = request

  return `You are a helpful SQL tutor. Explain what this query does in simple terms.

Question: ${question?.title ?? 'Unknown'}
Student's SQL: ${sql ?? 'N/A'}

Explain:
1. What the query returns
2. How it works step by step
3. Any important SQL concepts used

Keep it under 5 sentences.`
}

export function buildAlternativesPrompt(request: AlternativeQueryRequest): string {
  const { question, studentAnswer } = request

  return `You are a helpful SQL tutor. The student wrote this query:

Question: ${question?.title ?? 'Unknown'}
Student's SQL: ${studentAnswer ?? 'N/A'}

Suggest 1-2 alternative queries that also solve the problem. Each should use a different SQL approach if possible.

Format each alternative as:
ALTERNATIVE: <sql>
EXPLANATION: <why this works>

Do not include any other text.`
}
