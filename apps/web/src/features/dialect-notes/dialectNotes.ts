export const DIALECT_NOTES = [
  {
    id: 'limit-top',
    title: 'LIMIT vs TOP',
    content: `SQLite uses LIMIT to restrict rows, while SQL Server uses TOP.\n\nSQLite:\nSELECT * FROM users LIMIT 10;\n\nSQL Server:\nSELECT TOP 10 * FROM users;`,
    tags: ['syntax', 'portability']
  },
  {
    id: 'string-concat',
    title: 'String Concatenation',
    content: `SQLite uses || for concatenation, unlike MySQL's CONCAT().\n\nSQLite:\nSELECT first_name || ' ' || last_name FROM users;\n\nMySQL:\nSELECT CONCAT(first_name, ' ', last_name) FROM users;`,
    tags: ['syntax', 'strings']
  },
  {
    id: 'date-functions',
    title: 'Date Functions',
    content: `SQLite uses strftime() for date formatting.\n\nSQLite:\nSELECT strftime('%Y-%m-%d', created_at) FROM orders;\n\nMySQL:\nSELECT DATE_FORMAT(created_at, '%Y-%m-%d') FROM orders;`,
    tags: ['syntax', 'dates']
  },
  {
    id: 'null-handling',
    title: 'NULL Handling',
    content: `SQLite follows standard SQL NULL semantics.\n- NULL = NULL is NULL (not TRUE)\n- Use IS NULL or IS NOT NULL\n- COALESCE() works same across dialects`,
    tags: ['concepts', 'sql-standard']
  },
  {
    id: 'type-affinity',
    title: 'Type Affinity',
    content: `SQLite uses type affinity, not strict types.\n\nStores as: NULL, INTEGER, REAL, TEXT, BLOB\n\nAuto-conversion happens during operations.\nLearn more: https://www.sqlite.org/datatype3.html`,
    tags: ['concepts', 'data-types']
  },
  {
    id: 'join-support',
    title: 'JOIN Support',
    content: `SQLite supports all standard JOIN types:\n- INNER JOIN\n- LEFT OUTER JOIN\n- RIGHT OUTER JOIN\n- FULL OUTER JOIN\n- CROSS JOIN\n- NATURAL JOIN`,
    tags: ['concepts', 'joins']
  },
  {
    id: 'aggregate-functions',
    title: 'Aggregate Functions',
    content: `Common aggregates in SQLite:\n- COUNT(), SUM(), AVG(), MIN(), MAX()\n- GROUP BY with HAVING\n- Window functions (SQLite 3.25+)`,
    tags: ['functions', 'aggregation']
  },
  {
    id: 'window-functions',
    title: 'Window Functions',
    content: `SQLite 3.25+ supports window functions:\n- ROW_NUMBER()\n- RANK(), DENSE_RANK()\n- LAG(), LEAD()\n- FIRST_VALUE(), LAST_VALUE()\n\nSyntax:\nSELECT col, ROW_NUMBER() OVER (ORDER BY col) FROM table;`,
    tags: ['functions', 'advanced']
  },
  {
    id: 'ctes',
    title: 'Common Table Expressions',
    content: `SQLite supports CTEs (WITH clause):\n\nWITH cte_name AS (\n  SELECT * FROM table\n)\nSELECT * FROM cte_name;`,
    tags: ['concepts', 'cte']
  },
  {
    id: 'no-stored-procs',
    title: 'No Stored Procedures',
    content: `SQLite does NOT support stored procedures.\nAlternatives:\n- Use views for reusable queries\n- Create functions with extensions\n- Handle logic in application code`,
    tags: ['limitations', 'architecture']
  },
  {
    id: 'ddl-differences',
    title: 'DDL Differences',
    content: `SQLite DDL limitations:\n- No ADD COLUMN with constraints\n- Limited ALTER TABLE support\n- Use CREATE TABLE AS for complex changes\n- DROP COLUMN supported (3.35+)`,
    tags: ['DDL', 'limitations']
  },
  {
    id: 'transactions',
    title: 'Transactions',
    content: `SQLite supports ACID transactions:\n\nBEGIN TRANSACTION;\n-- your SQL here\nCOMMIT;\n\nOr use AUTOCOMMIT mode (default).`,
    tags: ['concepts', 'transactions']
  },
  {
    id: 'boolean-values',
    title: 'Boolean Values',
    content: `SQLite has no native BOOLEAN type.\nUses INTEGER: 0 = FALSE, 1 = TRUE\n\nComparison:\nSELECT * FROM table WHERE flag = 1;`,
    tags: ['data-types', 'concepts']
  },
  {
    id: 'random-function',
    title: 'RANDOM() Function',
    content: `SQLite provides RANDOM() for random values:\n\n-- Random integer\nSELECT RANDOM();\n\n-- Random between 1-100\nSELECT ABS(RANDOM() % 100) + 1;`,
    tags: ['functions', 'random']
  },
  {
    id: 'json-support',
    title: 'JSON Support',
    content: `SQLite 3.38+ has built-in JSON functions:\n\n-- Extract value\nSELECT json_extract(data, '$.name') FROM table;\n\n-- Check validity\nSELECT json_valid(json_column) FROM table;`,
    tags: ['functions', 'json']
  },
  {
    id: 'regexp-operator',
    title: 'Regexp Operator',
    content: `SQLite does NOT have built-in REGEXP.\nNeed to create function or use LIKE/GLOB.\n\nWorkaround:\nSELECT * FROM table WHERE col GLOB '[A-Z]*';`,
    tags: ['functions', 'patterns']
  }
];

export function getDialectNote(id: string) {
  return DIALECT_NOTES.find(n => n.id === id) || null;
}

export function getAllDialectNotes() {
  return DIALECT_NOTES;
}
