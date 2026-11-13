import type { Topic } from './schemas'

export const TOPICS_META: Topic[] = [
  { id: 'select-basics', title: 'SELECT Basics', order: 0 },
  { id: 'where-filters', title: 'WHERE Filters', order: 1 },
  { id: 'order-by', title: 'ORDER BY & LIMIT', order: 2 },
  { id: 'aggregate-functions', title: 'Aggregate Functions', order: 3 },
  { id: 'group-by', title: 'GROUP BY & HAVING', order: 4 },
  { id: 'joins', title: 'JOINs', order: 5 },
  { id: 'subqueries', title: 'Subqueries', order: 6 },
  { id: 'set-operations', title: 'Set Operations', order: 7 },
  { id: 'string-functions', title: 'String Functions', order: 8 },
  { id: 'date-functions', title: 'Date Functions', order: 9 },
  { id: 'null-handling', title: 'NULL Handling', order: 10 },
  { id: 'window-functions', title: 'Window Functions', order: 11 },
  { id: 'cte', title: 'CTEs & Views', order: 12 },
  { id: 'dml', title: 'DML Operations', order: 13 },
  { id: 'ddl', title: 'DDL Operations', order: 14 },
  { id: 'index-constraints', title: 'Indexes & Constraints', order: 15 },
  { id: 'transactions', title: 'Transactions', order: 16 },
  { id: 'advanced-select', title: 'Advanced SELECT', order: 17 },
  { id: 'performance', title: 'Query Performance', order: 18 },
  { id: 'database-design', title: 'Database Design', order: 19 },
  { id: 'real-world', title: 'Real-World Scenarios', order: 20 },
  { id: 'challenge', title: 'Challenge Problems', order: 21 },
]

export const DATASETS_META = [
  { id: 'school', name: 'School Management', description: 'Students, teachers, courses, enrollments' },
]

export const TOTAL_QUESTIONS_PER_TOPIC: Record<string, number> = {
  'select-basics': 15,
  'where-filters': 10,
  'order-by': 8,
  'aggregate-functions': 8,
}

export function getTopicById(id: string): Topic | undefined {
  return TOPICS_META.find((t) => t.id === id)
}

export function getTopicsOrdered(): Topic[] {
  return TOPICS_META.slice().sort((a, b) => a.order - b.order)
}
