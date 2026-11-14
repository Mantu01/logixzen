import { z } from 'zod'

export const CURRENT_FORMAT_VERSION = 2

// --- Dataset schemas ---

export const ColumnMetaSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
  primaryKey: z.boolean().optional().default(false),
  foreignKey: z
    .object({ table: z.string().min(1).max(100), column: z.string().min(1).max(100) })
    .optional(),
  description: z.string().max(500).optional(),
})

export const TableMetaSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  columns: z.array(ColumnMetaSchema).min(1).max(50),
})

export const DatasetSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  setupSql: z.string().min(1).max(10_000_000),
  tables: z.array(TableMetaSchema).min(1).max(20),
})

export type Dataset = z.infer<typeof DatasetSchema>

// --- Topic schemas ---

export const TopicSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000).optional(),
  order: z.number().int().min(0),
})

export type Topic = z.infer<typeof TopicSchema>

// --- Question schemas ---

const BaseQuestionSchema = z.object({
  id: z.string().min(1).max(100),
  topicId: z.string().min(1).max(100),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  datasetId: z.string().min(1).max(100),
  hints: z.array(z.string()).min(1).max(10),
  explanation: z.string().max(5000).optional().default(''),
  tags: z.array(z.string()).max(10),
  points: z.number().min(1).max(100),
})

export const McqOptionSchema = z.object({
  id: z.string().min(1).max(200),
  text: z.string().min(1).max(2000),
})

const ValidationConfigSchema = z.object({
  mode: z.enum([
    'result-match',
    'mcq',
    'dml-check',
    'predict-output',
    'fill-blank',
    'table-design',
  ]),
  columnNamesMatter: z.boolean().optional().default(false),
  columnOrderMatters: z.boolean().optional().default(false),
  orderMatters: z.boolean().optional().default(true),
  floatTolerance: z.number().optional().default(0.001),
  caseSensitiveStrings: z.boolean().optional().default(false),
  requiredTechniques: z.array(z.string()).optional(),
  forbiddenTechniques: z.array(z.string()).optional(),
  verificationQuery: z.string().optional(),
})

export type ValidationConfig = z.infer<typeof ValidationConfigSchema>

export const TestCaseSchema = z.object({
  id: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  expected: z.union([
    z.object({
      type: z.literal('literal'),
      columns: z.array(z.string()),
      rows: z.array(z.array(z.unknown())),
    }),
    z.object({ type: z.literal('fromSolution') }),
  ]),
  hidden: z.boolean().optional().default(false),
})

export type TestCase = z.infer<typeof TestCaseSchema>

const validationWith = (mode: 'result-match' | 'mcq' | 'fill-blank' | 'predict-output' | 'dml-check') =>
  ValidationConfigSchema.extend({ mode: z.literal(mode).optional() }).optional().default({
    mode,
    columnNamesMatter: false,
    columnOrderMatters: false,
    orderMatters: true,
    floatTolerance: 0.001,
    caseSensitiveStrings: false,
  })

const optionalTestCases = z.array(TestCaseSchema).max(20).optional().default([])

export const QueryQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('query'),
  solutionSql: z.string(),
  validation: validationWith('result-match'),
  testCases: z.array(TestCaseSchema).min(1).max(20),
})

export const McqSingleQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('mcq-single'),
  options: z.array(McqOptionSchema).min(2).max(10),
  correctOptionId: z.string(),
  validation: validationWith('mcq'),
  testCases: optionalTestCases,
})

export const McqMultiQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('mcq-multi'),
  options: z.array(McqOptionSchema).min(2).max(10),
  correctOptionIds: z.array(z.string()).min(1),
  validation: validationWith('mcq'),
  testCases: optionalTestCases,
})

export const FillBlankQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('fill-blank'),
  blankTemplate: z.string(),
  acceptedAnswers: z.record(z.string(), z.array(z.string())).refine((v) => Object.keys(v).length >= 1, { message: 'At least one answer is required' }),
  validation: validationWith('fill-blank'),
})

export const PredictOutputQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('predict-output'),
  expectedOutput: z.array(z.record(z.string(), z.unknown())),
  validation: validationWith('predict-output'),
  testCases: z.array(TestCaseSchema).min(1).max(5),
})

export const DebugQueryQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('debug-query'),
  brokenQuery: z.string(),
  solutionSql: z.string(),
  validation: validationWith('result-match'),
  testCases: z.array(TestCaseSchema).min(1).max(5),
})

export const DmlCheckQuestionSchema = BaseQuestionSchema.extend({
  type: z.literal('dml-check'),
  dmlStatement: z.string(),
  verificationQuery: z.string(),
  expectedChanges: z.number(),
  validation: validationWith('dml-check'),
})

export const QuestionSchema = z.discriminatedUnion('type', [
  QueryQuestionSchema,
  McqSingleQuestionSchema,
  McqMultiQuestionSchema,
  FillBlankQuestionSchema,
  PredictOutputQuestionSchema,
  DebugQueryQuestionSchema,
  DmlCheckQuestionSchema,
])

export type Question = z.infer<typeof QuestionSchema>
export type QuestionType = Question['type']

// --- ValidationResult types ---

export const ValidationReportSchema = z.object({
  version: z.number(),
  isValid: z.boolean(),
  errors: z.array(
    z.object({
      type: z.string(),
      path: z.string(),
      message: z.string(),
      suggestion: z.string().optional(),
    })
  ),
  warnings: z
    .array(
      z.object({
        type: z.string(),
        path: z.string(),
        message: z.string(),
        suggestion: z.string().optional(),
      })
    )
    .optional(),
})

export type ValidationError = {
  type: string
  path: string
  message: string
  suggestion?: string
}

export type ValidationWarning = {
  type: string
  path: string
  message: string
  suggestion?: string
}

export type ValidationResult = {
  valid: boolean
  errors: ValidationError[]
  warnings?: ValidationWarning[]
}
