import { z } from 'zod';

export const IMPORT_FORMAT_VERSION = 2;

export const ImportedDatasetSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  setupSql: z.string().min(1).max(10_000_000),
  tables: z.array(
    z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      columns: z.array(
        z.object({
          name: z.string().min(1).max(100),
          type: z.string().min(1).max(50),
          primaryKey: z.boolean().optional().default(false),
          foreignKey: z
            .object({ table: z.string().min(1).max(100), column: z.string().min(1).max(100) })
            .optional(),
          description: z.string().max(500).optional(),
        })
      ).min(1).max(50),
    })
  ).min(1).max(20),
});

export const ImportedTopicSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000).optional(),
  order: z.number().int().min(0),
});

const BaseImportedQuestionSchema = z.object({
  id: z.string().min(1).max(100),
  topicId: z.string().min(1).max(100),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  datasetId: z.string().min(1).max(100),
  hints: z.array(z.string()).min(1).max(10),
  explanation: z.string().min(1).max(5000),
  tags: z.array(z.string()).max(10),
  points: z.number().min(1).max(100),
});

const McqOptionSchema = z.object({
  id: z.string().min(1).max(200),
  text: z.string().min(1).max(2000),
});

const ImportTestCaseSchema = z.object({
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
});

const ValidationConfigSchema = z.object({
  mode: z.enum(['result-match', 'mcq', 'dml-check', 'predict-output', 'fill-blank', 'table-design']),
  columnNamesMatter: z.boolean().optional().default(false),
  columnOrderMatters: z.boolean().optional().default(false),
  orderMatters: z.boolean().optional().default(true),
  floatTolerance: z.number().optional().default(0.001),
  caseSensitiveStrings: z.boolean().optional().default(false),
  requiredTechniques: z.array(z.string()).optional(),
  forbiddenTechniques: z.array(z.string()).optional(),
  verificationQuery: z.string().optional(),
});

export const ImportedQueryQuestionSchema = BaseImportedQuestionSchema.extend({
  type: z.literal('query'),
  solutionSql: z.string(),
  validation: ValidationConfigSchema.extend({ mode: z.literal('result-match') }),
  testCases: z.array(ImportTestCaseSchema).min(1).max(20),
});

export const ImportedMcqSingleQuestionSchema = BaseImportedQuestionSchema.extend({
  type: z.literal('mcq-single'),
  options: z.array(McqOptionSchema).min(2).max(10),
  correctOptionId: z.string(),
  validation: ValidationConfigSchema.extend({ mode: z.literal('mcq') }),
  testCases: z.array(ImportTestCaseSchema).min(1).max(5),
});

export const ImportedMcqMultiQuestionSchema = BaseImportedQuestionSchema.extend({
  type: z.literal('mcq-multi'),
  options: z.array(McqOptionSchema).min(2).max(10),
  correctOptionIds: z.array(z.string()).min(1),
  validation: ValidationConfigSchema.extend({ mode: z.literal('mcq') }),
  testCases: z.array(ImportTestCaseSchema).min(1).max(5),
});

export const ImportedFillBlankQuestionSchema = BaseImportedQuestionSchema.extend({
  type: z.literal('fill-blank'),
  blankTemplate: z.string(),
  acceptedAnswers: z.record(z.number(), z.array(z.string())).min(1),
  validation: ValidationConfigSchema.extend({ mode: z.literal('fill-blank') }),
});

export const ImportedPredictOutputQuestionSchema = BaseImportedQuestionSchema.extend({
  type: z.literal('predict-output'),
  expectedOutput: z.array(z.record(z.string(), z.unknown())),
  validation: ValidationConfigSchema.extend({ mode: z.literal('predict-output') }),
  testCases: z.array(ImportTestCaseSchema).min(1).max(5),
});

export const ImportedDebugQueryQuestionSchema = BaseImportedQuestionSchema.extend({
  type: z.literal('debug-query'),
  brokenQuery: z.string(),
  solutionSql: z.string(),
  validation: ValidationConfigSchema.extend({ mode: z.literal('result-match') }),
  testCases: z.array(ImportTestCaseSchema).min(1).max(5),
});

export const ImportedDmlCheckQuestionSchema = BaseImportedQuestionSchema.extend({
  type: z.literal('dml-check'),
  dmlStatement: z.string(),
  verificationQuery: z.string(),
  expectedChanges: z.number(),
  validation: ValidationConfigSchema.extend({ mode: z.literal('dml-check') }),
});

export const ImportedQuestionSchema = z.discriminatedUnion('type', [
  ImportedQueryQuestionSchema,
  ImportedMcqSingleQuestionSchema,
  ImportedMcqMultiQuestionSchema,
  ImportedFillBlankQuestionSchema,
  ImportedPredictOutputQuestionSchema,
  ImportedDebugQueryQuestionSchema,
  ImportedDmlCheckQuestionSchema,
]);

export const LogixZenImportSchema = z.object({
  formatVersion: z.literal(2),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  author: z.string().max(200).optional(),
  datasets: z.array(ImportedDatasetSchema),
  topics: z.array(ImportedTopicSchema),
  questions: z.array(ImportedQuestionSchema),
});

export type ImportedDataset = z.infer<typeof ImportedDatasetSchema>;
export type ImportedTopic = z.infer<typeof ImportedTopicSchema>;
export type ImportedQuestion = z.infer<typeof ImportedQuestionSchema>;
export type LogixZenImport = z.infer<typeof LogixZenImportSchema>;
export type ImportValidationError = {
  path: string;
  message: string;
};
export type ImportValidationResult = {
  valid: boolean;
  errors: ImportValidationError[];
  warnings?: { path: string; message: string }[];
};
