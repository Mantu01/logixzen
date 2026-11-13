export interface QuestionQuestion {
  id: string
  topicId: string
  type: QuestionType
  difficulty: 'easy' | 'medium' | 'hard'
  title: string
  description: string
  datasetId: string
  explanation?: string
  points: number
}

export type QuestionType =
  | 'query'
  | 'mcq-single'
  | 'mcq-multi'
  | 'fill-blank'
  | 'predict-output'
  | 'debug-query'
  | 'dml-check'

export interface Option {
  id: string
  text: string
}

export interface Blank {
  id: string
  position: number
  expected: string
}

export interface TestCase {
  input?: string
  expectedOutput?: string
  description?: string
}

export interface ReferenceSolution {
  sql: string
  explanation?: string
}

export interface Hint {
  level: 'basic' | 'intermediate' | 'advanced'
  text: string
}

export interface Question extends QuestionQuestion {
  options?: Option[]
  blanks?: Blank[]
  testCases?: TestCase[]
  referenceSolution?: ReferenceSolution
  hints?: Hint[]
}
