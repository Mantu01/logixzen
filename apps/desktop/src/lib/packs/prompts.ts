const QUESTION_PACK_PROMPT = `You are a content generator for LogixZen, an offline SQL practice desktop app.

Generate a LogixZen QUESTIONS PACK as a single JSON file. Reply with raw JSON only, no markdown fences.

Top-level shape:
{
  "version": 2,
  "topics": [{ "id": "string", "title": "string", "description": "string", "order": 0 }],
  "questions": [ ... ]
}

Every question object must have:
- "id": unique slug, e.g. "joins-001"
- "topicId": must match one topic id above
- "type": one of "query" | "mcq-single" | "mcq-multi" | "fill-blank" | "predict-output" | "debug-query" | "dml-check"
- "difficulty": "easy" | "medium" | "hard"
- "title": short question title
- "description": full question statement shown to the learner
- "datasetId": id of the dataset the question runs against
- "hints": 1-10 progressive hint strings
- "explanation": why the solution is correct, shown after solving
- "tags": 0-10 topic tags
- "points": integer 1-100
- "validation": { "mode": "result-match", "orderMatters": true|false, "columnNamesMatter": true|false, "floatTolerance": 0.001, "caseSensitiveStrings": false }
- "solutionSql": the canonical correct query (for query/debug-query/dml-check)
- "testCases": 1-20 objects: { "id": "tc-1", "description": "what it checks", "expected": { "type": "fromSolution" } or { "type": "literal", "columns": ["col"], "rows": [["val"]] }, "hidden": false }

Type-specific extras:
- mcq-single: "options": [{ "id": "a", "text": "..." }, ...], "correctOptionId": "a", validation.mode = "mcq"
- mcq-multi: same options plus "correctOptionIds": ["a","c"]
- fill-blank: "blankTemplate": "SELECT ___ FROM users", "acceptedAnswers": { "1": ["COUNT(*)", "count(*)"] }, validation.mode = "fill-blank"
- predict-output: "expectedOutput": [ { "col": value, ... } ] (array of row objects), validation.mode = "predict-output"
- debug-query: "brokenQuery": "SELECT ...", "solutionSql": "SELECT ..."
- dml-check: "dmlStatement": "UPDATE ...", "verificationQuery": "SELECT COUNT(*) ...", "expectedChanges": 5, validation.mode = "dml-check"

Rules:
- Target SQLite dialect. Queries must run on an in-memory SQLite database built by the dataset setup SQL.
- Keep every required field present. Do not invent new keys.
- Make descriptions self-contained and educational.`;

const DATABASE_PACK_PROMPT = `You are a content generator for LogixZen, an offline SQL practice desktop app.

Generate a LogixZen DATABASES PACK as a single JSON file. Reply with raw JSON only, no markdown fences.

Top-level shape:
{
  "version": 2,
  "datasets": [ ... ]
}

Every dataset object must have:
- "id": unique slug, e.g. "school"
- "name": human readable name
- "description": what the database models
- "setupSql": one string containing all CREATE TABLE, indexes and INSERT seed statements, valid for in-memory SQLite
- "tables": [{ "name": "users", "description": "...", "columns": [{ "name": "id", "type": "INTEGER", "primaryKey": true, "foreignKey": { "table": "orders", "column": "user_id" }, "description": "..." }] }]

Rules:
- setupSql must execute top-to-bottom without errors on a fresh database with PRAGMA foreign_keys = ON.
- Declare PRIMARY KEY and FOREIGN KEY constraints inside CREATE TABLE so relationships can be drawn.
- Provide 5-25 realistic seed rows per table so queries return meaningful results.
- Keep table/column metadata in sync with setupSql exactly.`;

const NOTES_PACK_PROMPT = `You are a content generator for LogixZen, an offline SQL practice desktop app.

Generate a LogixZen NOTES PACK as a single JSON file. Reply with raw JSON only, no markdown fences.

Top-level shape:
{
  "version": 2,
  "notes": [ ... ]
}

Every note object must have:
- "id": unique slug, e.g. "joins-basics"
- "title": note title
- "category": grouping category, e.g. "Fundamentals", "Aggregation", "Joins"
- "tags": 0-10 topic tags
- "content": the note body as markdown (headings, lists, code fences for SQL)

Rules:
- Write EXTENSIVE, COMPREHENSIVE study notes — each note must be a complete mini-course (aim for 8,000–15,000+ characters).
- Cover every concept from absolute zero: explain terminology before using it, use analogies, show mistakes and corrections.
- Progress from basics → intermediate → advanced within each note. Include "Key Takeaways" and "Common Mistakes" sections.
- Use SQLite-compatible SQL examples. Every code block must include comments explaining WHY it works.
- Include visual ASCII diagrams where helpful (e.g., showing how JOINs combine tables).
- Organize notes by topic category matching these IDs: select-basics, where-filters, order-by-limit, aggregate-functions, group-by-having, joins, subqueries, set-operations, string-functions, date-functions, null-handling, window-functions, cte-views, dml-operations, ddl-schema, index-constraints, transactions, advanced-select, performance, database-design, real-world, challenge-patterns.
- Create at least one note per topic ID above. Each note should stand alone as a complete reference.`;

export const PACK_PROMPTS = {
  questions: QUESTION_PACK_PROMPT,
  databases: DATABASE_PACK_PROMPT,
  notes: NOTES_PACK_PROMPT,
} as const;
