import { describe, expect, it } from '@jest/globals'
import { DatasetSchema, TopicSchema, QuestionSchema } from '../src/content/schemas'
import { checkSafety, validateConsistency } from '../src/content/validators'

describe('DatasetSchema', () => {
  it('validates a correct dataset', () => {
    const dataset = {
      id: 'school',
      name: 'School Management',
      description: 'A school database',
      setupSql: "CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT);",
      tables: [
        {
          name: 'students',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'name', type: 'TEXT' },
          ],
        },
      ],
    }
    const result = DatasetSchema.safeParse(dataset)
    expect(result.success).toBe(true)
  })

  it('rejects missing id', () => {
    const dataset = { name: 'School', description: 'desc', setupSql: 'SELECT 1', tables: [] }
    const result = DatasetSchema.safeParse(dataset)
    expect(result.success).toBe(false)
  })

  it('rejects empty tables', () => {
    const dataset = { id: 'x', name: 'x', description: 'x', setupSql: 'SELECT 1', tables: [] }
    const result = DatasetSchema.safeParse(dataset)
    expect(result.success).toBe(false)
  })
})

describe('TopicSchema', () => {
  it('validates a correct topic', () => {
    const topic = { id: 'select-basics', title: 'SELECT Basics', order: 0 }
    const result = TopicSchema.safeParse(topic)
    expect(result.success).toBe(true)
  })

  it('rejects missing order', () => {
    const topic = { id: 'x', title: 'X' }
    const result = TopicSchema.safeParse(topic)
    expect(result.success).toBe(false)
  })
})

describe('QuestionSchema', () => {
  it('validates a query question', () => {
    const q = {
      id: 'select-001',
      topicId: 'select-basics',
      type: 'query',
      difficulty: 'easy',
      title: 'Select All',
      description: 'Write a query',
      datasetId: 'school',
      hints: ['Use SELECT'],
      solutionSql: 'SELECT * FROM students;',
      explanation: 'Simple select',
      tags: ['select'],
      points: 10,
      validation: { mode: 'result-match' },
      testCases: [{ id: 'tc-1', expected: { type: 'fromSolution' } }],
    }
    const result = QuestionSchema.safeParse(q)
    expect(result.success).toBe(true)
  })

  it('validates an mcq-single question', () => {
    const q = {
      id: 'mcq-001',
      topicId: 'select-basics',
      type: 'mcq-single',
      difficulty: 'easy',
      title: 'What is SELECT?',
      description: 'Choose the answer',
      datasetId: 'school',
      hints: ['Think about SQL'],
      explanation: 'SELECT retrieves data',
      tags: ['select'],
      points: 10,
      options: [{ id: 'a', text: 'Retrieves data' }, { id: 'b', text: 'Deletes data' }],
      correctOptionId: 'a',
      validation: { mode: 'mcq' },
      testCases: [{ id: 'tc-1', expected: { type: 'literal', columns: ['r'], rows: [['c']] } }],
    }
    const result = QuestionSchema.safeParse(q)
    expect(result.success).toBe(true)
  })

  it('rejects invalid question type', () => {
    const q = {
      id: 'x',
      topicId: 't',
      type: 'invalid-type',
      difficulty: 'easy',
      title: 'T',
      description: 'D',
      datasetId: 'd',
      hints: ['h'],
      explanation: 'e',
      tags: [],
      points: 10,
      validation: { mode: 'result-match' },
      testCases: [{ id: 'tc-1', expected: { type: 'fromSolution' } }],
    }
    const result = QuestionSchema.safeParse(q)
    expect(result.success).toBe(false)
  })
})

describe('checkSafety', () => {
  it('allows safe SQL', () => {
    const result = checkSafety('SELECT * FROM students;')
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('blocks ATTACH', () => {
    const result = checkSafety("ATTACH DATABASE 'evil.db' AS evil;")
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('blocks LOAD_EXTENSION', () => {
    const result = checkSafety('LOAD_EXTENSION evil;')
    expect(result.valid).toBe(false)
  })
})

describe('validateConsistency', () => {
  it('passes when all references are valid', () => {
    const datasets = [{ id: 'school', name: 'School', description: 'desc', setupSql: 'SELECT 1', tables: [] }]
    const topics = [{ id: 'select-basics', title: 'Select Basics', order: 0 }]
    const questions = [
      {
        id: 'q1',
        topicId: 'select-basics',
        type: 'query',
        difficulty: 'easy',
        title: 'T',
        description: 'D',
        datasetId: 'school',
        hints: ['h'],
        explanation: 'e',
        tags: [],
        points: 10,
        validation: { mode: 'result-match' },
        testCases: [{ id: 'tc-1', expected: { type: 'fromSolution' } }],
      },
    ]
    const result = validateConsistency(questions, datasets, topics)
    expect(result.valid).toBe(true)
  })

  it('flags invalid dataset reference', () => {
    const datasets: Array<{ id: string }> = []
    const topics = [{ id: 't1', title: 'T', order: 0 }]
    const questions = [
      {
        id: 'q1',
        topicId: 't1',
        type: 'query',
        difficulty: 'easy',
        title: 'T',
        description: 'D',
        datasetId: 'nonexistent',
        hints: ['h'],
        explanation: 'e',
        tags: [],
        points: 10,
        validation: { mode: 'result-match' },
        testCases: [{ id: 'tc-1', expected: { type: 'fromSolution' } }],
      },
    ]
    const result = validateConsistency(questions, datasets, topics)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.type === 'invalid-dataset-reference')).toBe(true)
  })

  it('flags duplicate question IDs', () => {
    const datasets = [{ id: 'd', name: 'D', description: 'd', setupSql: 'S', tables: [] }]
    const topics = [{ id: 't1', title: 'T', order: 0 }]
    const questions = [
      {
        id: 'dup',
        topicId: 't1',
        type: 'query',
        difficulty: 'easy',
        title: 'T',
        description: 'D',
        datasetId: 'd',
        hints: ['h'],
        explanation: 'e',
        tags: [],
        points: 10,
        validation: { mode: 'result-match' },
        testCases: [{ id: 'tc-1', expected: { type: 'fromSolution' } }],
      },
      {
        id: 'dup',
        topicId: 't1',
        type: 'query',
        difficulty: 'easy',
        title: 'T',
        description: 'D',
        datasetId: 'd',
        hints: ['h'],
        explanation: 'e',
        tags: [],
        points: 10,
        validation: { mode: 'result-match' },
        testCases: [{ id: 'tc-1', expected: { type: 'fromSolution' } }],
      },
    ]
    const result = validateConsistency(questions, datasets, topics)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.type === 'duplicate-id')).toBe(true)
  })
})
