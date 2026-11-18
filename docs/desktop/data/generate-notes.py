#!/usr/bin/env python3
"""Generate comprehensive SQL study notes for LogixZen."""
import json, textwrap

NOTES = []

def n(rid, title, category, tags, content):
    NOTES.append({"id": rid, "title": title, "category": category, "tags": tags, "content": content.strip()})

# ─── SELECT BASICS ──────────────────────────────────────────────────────────
n("note-sql-basics-01", "SELECT Statement Fundamentals — Complete Beginner Guide", "SQL Basics",
 ["select", "basics", "fundamentals", "columns", "wildcard", "alias"], """
# SELECT Statement Fundamentals — Complete Beginner Guide

This is your **starting point**. If you've never written a line of SQL before, this note will give you everything you need to begin confidently. By the end, you'll understand how databases store information and how to ask questions of them.

---

## What Is SQL?

**SQL** (Structured Query Language) is the language used to talk to relational databases. Think of a database like a giant spreadsheet system — tables hold data, and SQL lets you read, add, change, or remove that data.

Every SQL statement ends with a semicolon (`;`). SQLite (the engine LogixZen uses) makes it optional, but good habit: always include it.

```sql
-- This is a comment. The database ignores anything after '--'
SELECT first_name FROM students;  -- This runs!
```

---

## What Is a Database Table?

A table is a collection of related data organized in rows and columns. Here's what the `students` table looks like conceptually:

```
+----+------------+-----------+---------------------+-------+----------+
| id | first_name | last_name | email               | gpa   | dept_id  |
+----+------------+-----------+---------------------+-------+----------+
| 1  | Alice      | Johnson   | alice@logixzen.edu  | 3.85  |    1     |
| 2  | Bob        | Smith     | bob@logixzen.edu    | 3.20  |    2     |
| 3  | Carol      | Williams  | carol@logixzen.edu  | NULL  |    1     |
+----+------------+-----------+---------------------+-------+----------+
         ^ row (record)          Each column holds one type of info
```

- **Row** (also called a *record* or *tuple*) = one entry, one student
- **Column** (also called a *field*) = one piece of information about every row
- **Table** = the whole grid

---

## Your First Query: SELECT \*

The simplest possible query:

```sql
SELECT * FROM students;
```

What does this do?
- `SELECT *` means "give me ALL columns"
- `FROM students` means "from the table called students"

The `*` is called a **wildcard** — it stands for "everything." It's like saying "show me the entire phone book" instead of "show me just the names."

**When to use `SELECT *`:**
- Exploring a new table for the first time
- You genuinely need every column
- Quick debugging

**When NOT to use `SELECT *`:**
- In production code — it's slower and returns unnecessary data
- When you only need specific columns — naming columns explicitly is clearer
- On large tables — you might accidentally pull millions of rows

---

## Selecting Specific Columns

Instead of grabbing everything, pick exactly what you need:

```sql
-- Get only first name and GPA
SELECT first_name, gpa FROM students;

-- Three columns, in any order you choose
SELECT last_name, first_name, gpa FROM students;

-- Note: column order in SELECT doesn't have to match table definition
```

**Why pick specific columns?**
1. **Performance**: Less data travels from database to your app
2. **Clarity**: Future readers know exactly what you're using
3. **Security**: You don't expose sensitive columns accidentally (like passwords)

---

## Column Aliases (AS)

You can rename columns in your output using `AS`:

```sql
-- Give the gpa column a friendlier label
SELECT first_name, gpa AS grade_point_average FROM students;

-- Combine columns into one alias
SELECT first_name || ' ' || last_name AS full_name FROM students;

-- Numeric expression with alias
SELECT price, price * 1.1 AS price_with_tax FROM books;
```

Aliases make results readable. The `AS` keyword is optional but recommended — it makes intent clear.

---

## Literal Values in SELECT

You don't have to select from columns. You can return fixed values:

```sql
-- Returns one row with one value
SELECT 'Hello SQL';

-- Multiple literal values
SELECT 'LogixZen', 2024, TRUE;

-- Useful for annotations
SELECT first_name, 'Active' AS enrollment_status FROM students;
```

---

## DISTINCT: Removing Duplicates

If you want unique values only, add `DISTINCT`:

```sql
-- Every department that has at least one student
SELECT department_id FROM students;           -- Might show: 1, 2, 1, 3, 1, 2...
SELECT DISTINCT department_id FROM students;  -- Shows: 1, 2, 3 (no repeats!)

-- Unique cities
SELECT DISTINCT city FROM students;

-- DISTINCT works across multiple columns too
SELECT DISTINCT city, state FROM students;  -- Unique city-state pairs
```

⚠️ **Important:** `DISTINCT` applies to the **entire row**, not individual columns.
```sql
-- This gives unique COMBINATIONS of first_name and last_name
SELECT DISTINCT first_name, last_name FROM students;
```

---

## LIMIT: Controlling Result Size

`LIMIT` restricts how many rows come back:

```sql
-- Just the first 5 students
SELECT * FROM students LIMIT 5;

-- Top 3 by some criteria (we'll learn ORDER BY next)
SELECT first_name, gpa FROM students ORDER BY gpa DESC LIMIT 3;
```

**Pro tip:** Always use `LIMIT` when exploring unknown data. It prevents accidental massive downloads.

---

## OFFSET: Skipping Rows

Combine `LIMIT` and `OFFSET` for pagination (showing results page by page):

```sql
-- Skip first 10, show next 5
SELECT * FROM students LIMIT 5 OFFSET 10;

-- Equivalent modern syntax
SELECT * FROM students LIMIT 5 OFFSET 10;
SELECT * FROM students LIMIT 5, 10;  -- MySQL-style (not standard SQL)
```

Think of it like a book:
- `OFFSET 10` = turn past page 10
- `LIMIT 5` = read the next 5 pages

---

## Math Inside SELECT

You can do calculations directly in your query:

```sql
-- Simple arithmetic
SELECT first_name, gpa * 4 AS grade_points FROM students;

-- String concatenation (SQLite uses ||)
SELECT first_name || ' ' || last_name AS full_name FROM students;

-- Mixed operations
SELECT title, price, price * 1.08 AS price_with_8pct_tax FROM books;

-- CASE expressions (conditional logic)
SELECT first_name, gpa,
  CASE
    WHEN gpa >= 3.5 THEN 'Dean\\'s List'
    WHEN gpa >= 3.0 THEN 'Good Standing'
    ELSE 'Probation'
  END AS academic_status
FROM students;
```

---

## Understanding Data Types

Every column stores a specific kind of data:

| Type | Example | Description |
|------|---------|-------------|
| `INTEGER` | 42, -7, 0 | Whole numbers |
| `REAL` / `FLOAT` | 3.14, -0.5 | Decimal numbers |
| `TEXT` | 'Alice', 'hello' | Strings of characters |
| `BLOB` | (binary data) | Raw bytes, images, etc. |
| `NULL` | (nothing) | Missing/unknown value |

**Type affinity rules in SQLite:**
- `INTEGER PRIMARY KEY` → auto-increments automatically
- Text stored in numeric columns gets converted when compared
- Be explicit: `gpa REAL`, not just `gpa`

---

## The SELECT Clause Execution Order

You might think queries run top-to-bottom, but they actually execute in this order:

```
1. FROM       — Which table(s) to read
2. WHERE      — Filter rows (if present)
3. GROUP BY   — Group rows (if present)
4. HAVING     — Filter groups (if present)
5. SELECT     — Choose columns to display
6. ORDER BY   — Sort results
7. LIMIT      — Restrict number of rows
```

So when you write:
```sql
SELECT first_name, gpa FROM students WHERE gpa > 3.0 ORDER BY gpa DESC LIMIT 5;
```

The database:
1. Reads the `students` table
2. Keeps only rows where gpa > 3.0
3. Picks `first_name` and `gpa` columns
4. Sorts descending
5. Takes just 5 rows

---

## Common Mistakes Beginners Make

| Mistake | Why It Fails | Fix |
|---------|-------------|-----|
| Forgetting semicolon | SQLite may accept it, but other DBs require it | Always end with `;` |
| `WHERE column = NULL` | NULL is UNKNOWN, not equal to anything | Use `IS NULL` |
| Quoting column names with single quotes | Single quotes are for string VALUES | Use backticks or no quotes: `` `column` `` or just `column` |
| SELECT without FROM | No table source specified | Always specify FROM |
| Extra comma after last column | Syntax error | No trailing comma |

---

## Practice Checklist

Can you answer these? If yes, move on:
- [ ] I can write a query that selects all columns from a table
- [ ] I can select specific columns by name
- [ ] I understand what DISTINCT does
- [ ] I can use LIMIT to control result count
- [ ] I can create an alias with AS
- [ ] I know why SELECT \* is sometimes bad practice

---

### Key Takeaways

1. **`SELECT`** retrieves data; **`FROM`** specifies the table
2. **`*`** is a wildcard for "all columns" — use it sparingly
3. **`DISTINCT`** removes duplicate rows from results
4. **`LIMIT`** controls how many rows come back
5. **`AS`** creates aliases for cleaner output
6. Queries execute in a specific order (FROM → WHERE → SELECT → ORDER BY → LIMIT)
7. Always end statements with `;`

This is your foundation. Everything else in SQL builds on these concepts.""",

# ─── WHERE FILTERS ───────────────────────────────────────────────────────────
n("note-sql-basics-02", "WHERE Clause & Filtering Conditions — Comprehensive Guide", "SQL Basics",
 ["where", "filter", "condition", "operator", "logic", "comparison"], """
# WHERE Clause & Filtering Conditions — Comprehensive Guide

Now that you know how to retrieve data, you need to **filter** it. The `WHERE` clause is your primary tool for narrowing results to exactly what you care about.

---

## How WHERE Works

```sql
SELECT first_name, gpa
FROM students
WHERE gpa > 3.5;
```

The `WHERE` clause acts as a gatekeeper. Every row passes through this gate, and only rows where the condition evaluates to **TRUE** get through. Rows where the condition is FALSE or NULL are excluded.

---

## Comparison Operators

These operators compare a column value against another value:

| Operator | Meaning | Example |
|----------|---------|---------|
| `=` | Equal to | `department_id = 1` |
| `<>` or `!=` | Not equal to | `status <> 'Graduated'` |
| `<` | Less than | `gpa < 3.0` |
| `>` | Greater than | `salary > 60000` |
| `<=` | Less than or equal | `stock <= 5` |
| `>=` | Greater than or equal | `gpa >= 3.5` |

```sql
-- Students with GPA above 3.5
SELECT first_name, gpa FROM students WHERE gpa > 3.5;

-- Teachers not in department 1
SELECT first_name, department_id FROM teachers WHERE department_id <> 1;

-- Books priced at most $20
SELECT title, price FROM books WHERE price <= 20.00;
```

⚠️ **Critical warning about NULL with comparisons:**
```sql
-- These return ZERO rows (NOT what you expect):
SELECT * FROM students WHERE gpa = NULL;      -- Always FALSE with NULL
SELECT * FROM students WHERE gpa != NULL;     -- Also always FALSE

-- Correct way to check NULL:
SELECT * FROM students WHERE gpa IS NULL;
SELECT * FROM students WHERE gpa IS NOT NULL;
```

This happens because SQL uses **three-valued logic**: TRUE, FALSE, and **UNKNOWN**. Any comparison with NULL yields UNKNOWN, and WHERE only keeps TRUE rows.

---

## BETWEEN: Range Queries Made Easy

`BETWEEN` checks if a value falls within a range — and it's **inclusive** on both ends:

```sql
-- GPA between 3.0 and 3.5 (includes 3.0 and 3.5 exactly)
SELECT first_name, gpa FROM students
WHERE gpa BETWEEN 3.0 AND 3.5;

-- Years published between 1940 and 1965
SELECT title, published_year FROM books
WHERE published_year BETWEEN 1940 AND 1965;

-- Date range for enrollments
SELECT first_name, enrollment_date FROM students
WHERE enrollment_date BETWEEN '2022-01-01' AND '2022-12-31';
```

`BETWEEN` is shorthand for two comparisons combined with AND:
```sql
-- These are equivalent:
WHERE gpa BETWEEN 3.0 AND 3.5
-- Same as:
WHERE gpa >= 3.0 AND gpa <= 3.5
```

⚠️ **Be careful with dates!** `BETWEEN '2022-01-01' AND '2022-12-31'` includes midnight of Dec 31st but excludes anything on Jan 1st, 2023. To be safe with datetimes:
```sql
-- Safer date range (excludes all of 2023)
WHERE enrollment_date >= '2022-01-01' AND enrollment_date < '2023-01-01'
```

---

## IN: Match Any Value in a List

Instead of chaining OR conditions, use `IN`:

```sql
-- Teachers in departments 1, 2, or 3
SELECT first_name, department_id FROM teachers
WHERE department_id IN (1, 2, 3);

-- Equivalent to:
WHERE department_id = 1 OR department_id = 2 OR department_id = 3

-- String values in IN
SELECT course_number FROM courses
WHERE subject_id IN (1, 2, 3, 5);

-- Status filter
SELECT first_name, status FROM students
WHERE status IN ('Active', 'On Leave');
```

**IN with subqueries** is extremely powerful:
```sql
-- Students in departments with budget over 200k
SELECT first_name FROM students
WHERE department_id IN (
  SELECT id FROM departments WHERE budget > 200000
);
```

---

## LIKE: Pattern Matching

The `LIKE` operator matches patterns using wildcards:

| Wildcard | Meaning | Example | Matches |
|----------|---------|---------|---------|
| `%` | Zero or more characters | `'J%'` | Johnson, Jones, Jefferies |
| `%` | Zero or more characters | `'%son'` | Johnson, Watson,erson |
| `%` | Zero or more characters | `'%li%'` | Alice, Lincoln, Philip |
| `_` | Exactly one character | `'_a%'` | Al, An, Am (but not Alan) |

```sql
-- Last names starting with J
SELECT first_name, last_name FROM students
WHERE last_name LIKE 'J%';

-- Emails from university domain
SELECT first_name, email FROM students
WHERE email LIKE '%@logixzen.edu';

-- Phone numbers matching pattern 555-XXX
SELECT first_name, phone FROM students
WHERE phone LIKE '555-%';

-- Names where second letter is 'a'
SELECT first_name FROM students
WHERE first_name LIKE '_a%';
```

**Case-insensitive LIKE:**
```sql
-- Standard SQLite LIKE is case-insensitive for ASCII
WHERE last_name LIKE 'johnson'  -- matches 'Johnson', 'JOHNSON', etc.

-- For Unicode or explicit control, use LOWER()
WHERE LOWER(last_name) LIKE 'johnson%'
```

---

## Handling NULL Properly

We touched on this above, but let's go deeper because NULL is the #1 source of bugs in SQL.

```sql
-- Find students with NO advisor assigned
SELECT first_name, last_name FROM students
WHERE advisor_teacher_id IS NULL;

-- Find students who DO have a phone number
SELECT first_name, phone FROM students
WHERE phone IS NOT NULL;

-- Combine NULL check with other conditions
SELECT first_name, gpa FROM students
WHERE status = 'Active' AND gpa IS NOT NULL;
```

**NULL propagates through expressions:**
```sql
-- This returns NULL, not the actual price!
SELECT price + 10 FROM students WHERE price IS NULL;
-- NULL + 10 = NULL (unknown + known = unknown)

-- Safe calculation with COALESCE:
SELECT COALESCE(price, 0) + 10 FROM books;
-- If price is NULL, treat it as 0 first
```

---

## Logical Operators: AND, OR, NOT

Combine conditions to express complex filters:

### AND — All conditions must be true
```sql
-- Active students in Illinois
SELECT first_name, state FROM students
WHERE status = 'Active' AND state = 'IL';

-- Female students with GPA above 3.5
SELECT first_name, gender, gpa FROM students
WHERE gender = 'Female' AND gpa > 3.5;
```

### OR — At least one condition must be true
```sql
-- Students in either CS or Math department
SELECT first_name, department_id FROM students
WHERE department_id = 1 OR department_id = 2;

-- Or use IN (cleaner):
WHERE department_id IN (1, 2);
```

### NOT — Negate a condition
```sql
-- Students NOT in Computer Science
SELECT first_name FROM students
WHERE department_id <> 1;

-- Or with NOT:
WHERE NOT department_id = 1;

-- NOT with IN
SELECT first_name FROM students
WHERE department_id NOT IN (1, 2, 3);

-- NOT with LIKE
SELECT title FROM books
WHERE title NOT LIKE '%History%';
```

---

## Operator Precedence

SQL evaluates expressions in this order (high to low):

1. Parentheses `()`
2. `NOT`
3. `AND`
4. `OR`

```sql
-- WITHOUT parentheses — AND binds tighter:
WHERE status = 'Active' OR status = 'Graduated' AND gpa > 3.5
-- Actually evaluates as: Active OR (Graduated AND gpa > 3.5)

-- WITH parentheses — clear intent:
WHERE (status = 'Active' OR status = 'Graduated') AND gpa > 3.5
```

**Rule of thumb:** When mixing AND and OR, always use parentheses. It costs nothing and prevents confusion.

---

## The GREATEST / LEAST Functions

SQLite doesn't have native GREATEST/LEAST, but you can simulate them:

```sql
-- Maximum of three values (custom function needed or CASE)
SELECT first_name,
  CASE
    WHEN gpa >= min_gpa AND gpa >= max_gpa THEN gpa
    WHEN min_gpa >= gpa AND min_gpa >= max_gpa THEN min_gpa
    ELSE max_gpa
  END AS highest_score
FROM students;

-- COALESCE with ORDER BY for GREATEST-like behavior
SELECT first_name,
  (SELECT MAX(val) FROM (
    SELECT gpa AS val UNION ALL SELECT min_gpa UNION ALL SELECT max_gpa
  )) AS greatest_val
FROM students;
```

---

## Real-World WHERE Patterns

### Date Range Filter (the correct way)
```sql
-- Enrollment in calendar year 2022
SELECT first_name, enrollment_date FROM students
WHERE enrollment_date >= '2022-01-01'
  AND enrollment_date < '2023-01-01';
```

### Numeric Threshold with Tiered Logic
```sql
SELECT first_name, gpa,
  CASE
    WHEN gpa >= 3.8 THEN 'Summa'
    WHEN gpa >= 3.5 THEN 'Magna'
    WHEN gpa >= 3.0 THEN 'Cum Laude'
    ELSE 'None'
  END AS honors_level
FROM students
WHERE gpa IS NOT NULL;
```

### Existence Check (will expand with JOINs later)
```sql
-- Students who have at least one enrollment
SELECT first_name FROM students s
WHERE EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = s.id);
```

---

## Common Mistakes with WHERE

| Mistake | Problem | Fix |
|---------|---------|-----|
| `WHERE col = NULL` | Always false | `WHERE col IS NULL` |
| `WHERE col != NULL` | Always false | `WHERE col IS NOT NULL` |
| Mixing AND/OR without parens | Wrong results due to precedence | Add parentheses |
| Using LIKE with leading wildcard on huge tables | Can't use indexes efficiently | Accept the cost or redesign |
| Comparing strings with different collations | Surprising results | Use COLLATE or LOWER() |

---

### Key Takeaways

1. **WHERE** filters rows before they reach SELECT
2. **Comparison operators**: `=`, `<>`, `<`, `>`, `<=`, `>=`
3. **BETWEEN** is inclusive on both ends — use `>= start AND < end` for dates with times
4. **IN** replaces chains of OR conditions
5. **LIKE** supports `%` (any chars) and `_` (one char) wildcards
6. **NULL** requires `IS NULL` / `IS NOT NULL` — never `= NULL`
7. **AND** binds tighter than **OR** — use parentheses to be safe
8. WHERE executes before SELECT, so you can't reference SELECT aliases in WHERE""",

# ─── ORDER BY & LIMIT ────────────────────────────────────────────────────────
n("note-order-by-01", "ORDER BY & Sorting Results — Complete Guide", "Data Retrieval",
 ["order-by", "sort", "limit", "ranking", "nulls-first", "nulls-last"], """
# ORDER BY & Sorting Results — Complete Guide

Raw query results come back in an arbitrary order unless you tell the database how to sort them. `ORDER BY` gives you complete control over presentation order.

---

## Basic Ordering

```sql
-- Ascending (default — smallest first)
SELECT first_name, gpa FROM students ORDER BY gpa;

-- Explicit ascending (same as above)
SELECT first_name, gpa FROM students ORDER BY gpa ASC;

-- Descending (largest first)
SELECT first_name, gpa FROM students ORDER BY gpa DESC;
```

**ASC vs DESC:**
- `ASC` = Ascending = A→Z, 0→9, earliest→latest
- `DESC` = Descending = Z→A, 9→0, latest→earliest
- `ASC` is the default — omitting it still sorts ascending

---

## Multi-Column Sorting (Tiebreakers)

When the first sort column has duplicates, use a second column to break ties:

```sql
-- Primary: GPA descending, Secondary: last name alphabetically
SELECT first_name, last_name, gpa
FROM students
ORDER BY gpa DESC, last_name ASC;
```

How it works:
1. Sort ALL rows by `gpa DESC`
2. Among rows with the SAME gpa, sort by `last_name ASC`
3. The result is deterministic and reproducible

```sql
-- Three-level sorting: department, then GPA, then last name
SELECT department_id, first_name, last_name, gpa
FROM students
ORDER BY department_id ASC, gpa DESC, last_name ASC;
```

---

## ORDER BY with Expressions

You can sort by computed values, not just column names:

```sql
-- Sort by full name (concatenated in SELECT)
SELECT first_name || ' ' || last_name AS full_name, gpa
FROM students
ORDER BY full_name;

-- Sort by calculated age
SELECT first_name, date_of_birth,
  CAST((julianday('now') - julianday(date_of_birth)) / 365.25 AS INTEGER) AS age
FROM students
ORDER BY age DESC;
```

⚠️ Some databases don't allow alias references in ORDER BY. SQLite does, but it's safer to repeat the expression:
```sql
-- Safer cross-database approach
SELECT first_name, gpa
FROM students
ORDER BY gpa * 4;  -- Repeat the expression, don't rely on alias
```

---

## NULL Ordering Behavior

SQLite places NULLs **first** in ASCENDING order and **last** in DESCENDING order. This is often surprising:

```sql
-- NULL advisors appear FIRST (ascending)
SELECT first_name, advisor_teacher_id
FROM students
ORDER BY advisor_teacher_id;
-- NULLs at top, then 1, 2, 3...

-- NULL advisors appear LAST (descending)
SELECT first_name, advisor_teacher_id
FROM students
ORDER BY advisor_teacher_id DESC;
-- 5, 4, 3, 2, 1, then NULLs at bottom
```

### Forcing NULL Placement

Use the `NULLS FIRST` / `NULLS LAST` syntax (PostgreSQL-style, supported in newer SQLite):

```sql
-- Force NULLs to the end regardless of direction
SELECT first_name, gpa FROM students
ORDER BY gpa DESC NULLS LAST;

-- Force NULLs to the top in descending order
SELECT first_name, gpa FROM students
ORDER BY gpa DESC NULLS FIRST;

-- Portable trick: NULL is treated as largest in ASC, smallest in DESC
-- So negate to flip:
SELECT first_name, gpa FROM students
ORDER BY gpa IS NULL, gpa DESC;
-- gpa IS NULL evaluates to 1 (true) for NULL rows, 0 for non-NULL
-- Sorting by 1 then 0 puts NULLs last in DESC order
```

---

## LIMIT: Restricting Output

```sql
-- Top 5 students by GPA
SELECT first_name, gpa FROM students
ORDER BY gpa DESC
LIMIT 5;

-- First 10 records (stable order matters!)
SELECT * FROM students
ORDER BY id
LIMIT 10;
```

Without `ORDER BY`, `LIMIT` returns arbitrary rows — the "first 10" could change every time. Always combine LIMIT with ORDER BY for predictable results.

---

## OFFSET: Pagination

Skip rows before applying LIMIT — essential for paginated displays:

```sql
-- Page 1: rows 1-10
SELECT * FROM students ORDER BY id LIMIT 10 OFFSET 0;

-- Page 2: rows 11-20
SELECT * FROM students ORDER BY id LIMIT 10 OFFSET 10;

-- Page 3: rows 21-30
SELECT * FROM students ORDER BY id LIMIT 10 OFFSET 20;
```

**Formula for page N (1-indexed) with page size P:**
```
OFFSET = (N - 1) * P
```

For page 5 with 20 items per page: `(5-1) * 20 = 80`

---

## RANDOM Ordering

```sql
-- Pick random students (great for quizzes!)
SELECT first_name, last_name
FROM students
ORDER BY RANDOM()
LIMIT 5;

-- Shuffled book list
SELECT title FROM books
ORDER BY RANDOM()
LIMIT 10;
```

⚠️ **Warning:** `ORDER BY RANDOM()` requires sorting the ENTIRE table in memory. On large tables, this is very slow. Only use it for small datasets or when you truly need randomness.

---

## ORDER BY with Aggregates

Always pair ORDER BY with aggregates properly:

```sql
-- Average GPA per department, sorted worst to best
SELECT department_id, ROUND(AVG(gpa), 2) AS avg_gpa
FROM students
GROUP BY department_id
ORDER BY avg_gpa DESC;

-- Department with most students
SELECT department_id, COUNT(*) AS student_count
FROM students
GROUP BY department_id
ORDER BY student_count DESC
LIMIT 1;
```

---

## Deterministic Sorting: Always Add a Unique Tiebreaker

When sorting, ensure you have enough columns to produce a **unique, deterministic** ordering. Without it, rows with equal sort keys may appear in any order:

```sql
-- BAD: Two students with same GPA could swap positions
SELECT first_name, gpa FROM students ORDER BY gpa DESC;

-- GOOD: Stable, reproducible ordering
SELECT first_name, gpa FROM students ORDER BY gpa DESC, id ASC;
```

---

## Advanced: Ordering by Case Expression

```sql
-- Custom sort order (not alphabetical)
SELECT first_name, status FROM students
ORDER BY CASE status
  WHEN 'Active' THEN 1
  WHEN 'On Leave' THEN 2
  WHEN 'Graduated' THEN 3
  ELSE 4
END;

-- Prioritize recent enrollments within each status
SELECT first_name, status, enrollment_date FROM students
ORDER BY status, enrollment_date DESC;
```

---

## Performance Tips for ORDER BY

| Tip | Why |
|-----|-----|
| Index the ORDER BY column | Avoids filesort — dramatically faster |
| Include ORDER BY columns in composite index | Covers sort + filter in one scan |
| Avoid ORDER BY on TEXT columns for large datasets | String comparison is expensive |
| Use LIMIT with ORDER BY | Database can stop early once enough rows found |
| Don't ORDER BY computed expressions on huge tables | Forces full sort in memory |

```sql
-- Create an index that helps both WHERE and ORDER BY
CREATE INDEX idx_students_gpa ON students(gpa DESC);

-- Composite index for filtered + sorted queries
CREATE INDEX idx_students_dept_gpa ON students(department_id, gpa DESC);
```

---

### Key Takeaways

1. **ORDER BY** sorts results; default is ASC (ascending)
2. **DESC** reverses the sort order
3. Multiple ORDER BY columns act as tiebreakers (left to right)
4. **NULLS LAST/FIRST** controls where NULL values appear
5. **LIMIT + OFFSET** enables pagination
6. Always combine LIMIT with ORDER BY for predictable results
7. Add a unique column (like `id`) as final sort key for determinism
8. Index ORDER BY columns for performance""",

# ─── AGGREGATE FUNCTIONS ─────────────────────────────────────────────────────
n("note-aggregate-01", "Aggregate Functions Deep Dive — From Zero to Master", "Aggregation",
 ["aggregate", "count", "sum", "avg", "max", "min", "round", "coalesce"], """
# Aggregate Functions Deep Dive — From Zero to Master

Aggregate functions are among the most powerful tools in SQL. They take many rows and collapse them into a single summary value. This note covers everything from `COUNT(*)` to advanced aggregation patterns.

---

## The Five Core Aggregates

| Function | Purpose | Ignores NULL? |
|----------|---------|---------------|
| `COUNT(*)` | Count all rows | No — counts EVERYTHING including rows with all NULLs |
| `COUNT(column)` | Count non-null values | Yes — skips NULLs silently |
| `SUM(column)` | Total of all values | Yes — skips NULLs (treats as 0 in sum) |
| `AVG(column)` | Average (mean) value | Yes — divides sum by count of non-nulls |
| `MAX(column)` | Largest value | Yes — skips NULLs |
| `MIN(column)` | Smallest value | Yes — skips NULLs |

```sql
-- COUNT(*) vs COUNT(column)
SELECT
  COUNT(*) AS total_rows,           -- All 30 students
  COUNT(phone) AS with_phone,       -- Only those with phone ≠ NULL
  COUNT(DISTINCT department_id) AS unique_depts  -- Unique depts only
FROM students;
```

**Why the difference matters:**
- `COUNT(*)` = "How many items are in the bucket?"
- `COUNT(phone)` = "How many items in the bucket have a phone?"
- `COUNT(DISTINCT department_id)` = "How many different departments are represented?"

---

## SUM and AVG with Expressions

You're not limited to single columns — aggregate any expression:

```sql
-- Total inventory value
SELECT SUM(price * stock) AS total_value FROM books;

-- Average scholarship amount
SELECT AVG(amount_awarded) AS avg_scholarship FROM student_scholarships;

-- Total active fines collected
SELECT SUM(fine) AS total_fines FROM loans WHERE fine > 0;

-- Average grade points (convert letter grades to points)
SELECT AVG(
  CASE grade
    WHEN 'A' THEN 4.0 WHEN 'B' THEN 3.0
    WHEN 'C' THEN 2.0 WHEN 'D' THEN 1.0 ELSE 0.0
  END
) AS avg_grade_points FROM enrollments;
```

---

## Rounding Results

```sql
-- Round average GPA to 2 decimal places
SELECT ROUND(AVG(gpa), 2) AS avg_gpa FROM students;

-- Round money to nearest cent
SELECT ROUND(SUM(amount_awarded), 2) AS total_awarded FROM student_scholarships;

-- Round salary to thousands
SELECT ROUND(AVG(salary) / 1000, 1) AS avg_salary_k FROM teachers;

-- Integer truncation
SELECT CAST(AVG(gpa) AS INTEGER) AS truncated_gpa FROM students;
```

---

## NULL Behavior in Aggregation — Critical Detail

```sql
-- SUM of NULLs returns NULL, not 0
SELECT SUM(null_column) FROM some_table;  -- Returns NULL!

-- FIX with COALESCE:
SELECT COALESCE(SUM(null_column), 0) FROM some_table;

-- AVG ignores NULLs in the denominator
-- 5 non-null values sum to 15 → AVG = 3.0 (not 15/10 if 5 were NULL)
SELECT AVG(gpa) FROM students;

-- COUNT ignores NULLs; COUNT(*) does not
SELECT COUNT(*), COUNT(gpa), COUNT(DISTINCT gpa) FROM students;
-- Suppose: 30 total rows, 28 have non-null gpa, 5 unique gpa values
-- Result: 30, 28, 5
```

---

## MIN / MAX with Different Data Types

```sql
-- Numbers: obvious
SELECT MIN(gpa), MAX(gpa) FROM students;

-- Strings: lexicographic (alphabetical) order
SELECT MIN(last_name), MAX(last_name) FROM students;
-- Minimum = alphabetically first, Maximum = alphabetically last

-- Dates: chronologically
SELECT MIN(hire_date), MAX(hire_date) FROM teachers;

-- mixed types: SQLite uses type affinity
SELECT MIN(value) FROM mixed_table;  -- Works if types are compatible
```

---

## CORRELATION: Aggregate vs Non-Aggregate in Same Query

You cannot mix aggregated and non-aggregated columns arbitrarily:

```sql
-- INVALID — first_name is not aggregated and not in GROUP BY
SELECT first_name, COUNT(*) FROM students;
-- ERROR: column "first_name" must appear in GROUP BY or be aggregated

-- VALID — aggregate the non-grouped column
SELECT MAX(first_name), COUNT(*) FROM students;

-- VALID — include the column in GROUP BY
SELECT first_name, COUNT(*) FROM students GROUP BY first_name;
```

**The golden rule:** Every column in SELECT must either be:
1. Inside an aggregate function, OR
2. Listed in the GROUP BY clause

---

## Combining Aggregates in One Query

```sql
-- Full GPA statistics for the student body
SELECT
  COUNT(*) AS total_students,
  ROUND(AVG(gpa), 3) AS average_gpa,
  ROUND(MIN(gpa), 2) AS lowest_gpa,
  ROUND(MAX(gpa), 2) AS highest_gpa,
  ROUND(MAX(gpa) - MIN(gpa), 2) AS gpa_range
FROM students
WHERE gpa IS NOT NULL;
```

Output example:
```
total_students | average_gpa | lowest_gpa | highest_gpa | gpa_range
    28         |    3.412    |   2.10     |    4.00     |   1.90
```

---

## Conditional Aggregation (Pivot-Style)

Use `CASE` inside aggregates to create pivot-like summaries:

```sql
-- Student counts by status
SELECT
  COUNT(*) AS total,
  COUNT(CASE WHEN status = 'Active' THEN 1 END) AS active,
  COUNT(CASE WHEN status = 'Graduated' THEN 1 END) AS graduated,
  COUNT(CASE WHEN status = 'Suspended' THEN 1 END) AS suspended
FROM students;

-- Department spending breakdown
SELECT
  department_id,
  COUNT(*) AS teacher_count,
  ROUND(SUM(CASE WHEN salary > 80000 THEN 1 ELSE 0 END), 0) AS high_earners,
  ROUND(AVG(salary), 0) AS avg_salary
FROM teachers
GROUP BY department_id;
```

⚠️ `COUNT(CASE WHEN ...)` counts non-null results. If the CASE returns NULL (ELSE branch), it's not counted. This is different from counting rows.

---

## The HAVING Clause — Filtering After Aggregation

`WHERE` filters rows BEFORE grouping. `HAVING` filters groups AFTER aggregation:

```sql
-- WHERE: filter individuals before counting
SELECT department_id, COUNT(*) AS cnt
FROM students
WHERE status = 'Active'
GROUP BY department_id;

-- HAVING: filter groups after counting
SELECT department_id, COUNT(*) AS cnt
FROM students
GROUP BY department_id
HAVING COUNT(*) > 3;

-- Both together (most powerful pattern):
SELECT department_id, ROUND(AVG(gpa), 2) AS avg_gpa
FROM students
WHERE status = 'Active'
GROUP BY department_id
HAVING COUNT(*) >= 2
ORDER BY avg_gpa DESC;
```

**Decision tree:**
- Filtering on a regular column? → `WHERE`
- Filtering on an aggregate result? → `HAVING`
- Filtering on both? → `WHERE` then `HAVING`

---

## Distinct Aggregation

```sql
-- How many unique departments exist?
SELECT COUNT(DISTINCT department_id) FROM students;

-- How many unique GPA values are there?
SELECT COUNT(DISTINCT gpa) FROM students;

-- Unique city-state combinations
SELECT COUNT(DISTINCT city || ', ' || state) FROM students;
```

---

## Practical Aggregation Scenarios

### Grand Totals
```sql
-- One-row summary of the entire table
SELECT
  COUNT(*) AS records,
  SUM(amount) AS total_amount,
  AVG(amount) AS avg_amount,
  MIN(date) AS oldest,
  MAX(date) AS newest
FROM transactions;
```

### Per-Category Breakdown
```sql
-- Book stats by category
SELECT
  category,
  COUNT(*) AS titles,
  ROUND(AVG(price), 2) AS avg_price,
  SUM(stock) AS total_copies,
  MIN(price) AS cheapest,
  MAX(price) AS most_expensive
FROM books
GROUP BY category
ORDER BY titles DESC;
```

### Top-N Per Group (requires window functions — see that note later)
```sql
-- We can approximate with a correlated subquery:
SELECT d.name AS department, s.first_name, s.gpa
FROM students s
JOIN departments d ON s.department_id = d.id
WHERE s.gpa = (
  SELECT MAX(s2.gpa) FROM students s2 WHERE s2.department_id = s.department_id
)
ORDER BY d.name;
```

---

### Key Takeaways

1. **Five core aggregates**: COUNT, SUM, AVG, MAX, MIN
2. `COUNT(*)` counts rows; `COUNT(col)` skips NULLs
3. NULLs are ignored by SUM, AVG, MAX, MIN — use COALESCE to handle gracefully
4. Every non-aggregated column must appear in GROUP BY
5. **WHERE** filters rows before grouping; **HAVING** filters groups after
6. **Conditional aggregation** with CASE inside aggregates creates flexible reports
7. **ROUND()** cleans up floating-point display
8. Aggregation is evaluated AFTER WHERE but BEFORE ORDER BY""",

# ─── GROUP BY ────────────────────────────────────────────────────────────────
n("note-groupby-01", "GROUP BY & HAVING Mastery — The Art of Summarization", "Aggregation",
 ["group-by", "having", "aggregation", "rollup", "cube", "pivot"], """
# GROUP BY & HAVING Mastery — The Art of Summarization

GROUP BY is the bridge between raw data and meaningful summaries. It's one of the most important SQL concepts, and mastering it unlocks almost every reporting query you'll ever write.

---

## What Does GROUP BY Do?

Imagine you have 1,000 student records and want to know "how many students per department?" GROUP BY collapses all rows with the same department_id into one summary row:

```sql
-- Before GROUP BY: 30 rows (one per student)
SELECT * FROM students;

-- After GROUP BY: ~5 rows (one per department)
SELECT department_id, COUNT(*) AS student_count
FROM students
GROUP BY department_id;
```

The result looks like:
```
department_id | student_count
      1       |     12
      2       |      8
      3       |      5
      4       |      3
      5       |      2
```

---

## The Rules of GROUP BY

**Rule 1: Every column in SELECT must be either aggregated or grouped**

```sql
-- VALID: department_id is in GROUP BY
SELECT department_id, COUNT(*) FROM students GROUP BY department_id;

-- VALID: first_name is inside an aggregate
SELECT MAX(first_name), department_id FROM students GROUP BY department_id;

-- INVALID: first_name is neither aggregated nor in GROUP BY
SELECT first_name, COUNT(*) FROM students GROUP BY department_id;
-- ERROR: column "first_name" must appear in GROUP BY or be used in an aggregate function
```

**Rule 2: GROUP BY order does NOT determine output order**
```sql
-- These may return rows in ANY order — use ORDER BY to control it!
SELECT department_id, COUNT(*) FROM students GROUP BY department_id;
SELECT COUNT(*), department_id FROM students GROUP BY department_id;
```

**Rule 3: NULL values form their own group**
```sql
-- Students with NULL department_id all go into one group
SELECT department_id, COUNT(*) FROM students GROUP BY department_id;
-- You might see: NULL | 2  (these students have no department assigned)
```

---

## GROUP BY with Multiple Columns

Group by combinations, not just single columns:

```sql
-- One row per (semester, year) combination
SELECT semester, year, COUNT(*) AS enrollment_count
FROM enrollments
GROUP BY semester, year;

-- One row per (department, status) — cross-tab style
SELECT department_id, status, COUNT(*) AS count
FROM students
GROUP BY department_id, status;
```

This creates a matrix-like view. The database groups by the **composite key** — both columns together must match.

---

## HAVING: The Post-Group Filter

WHERE operates on individual rows. HAVING operates on groups:

```sql
-- Departments with MORE THAN 3 students
SELECT department_id, COUNT(*) AS cnt
FROM students
GROUP BY department_id
HAVING COUNT(*) > 3;

-- Subjects with average enrollment ABOVE 20
SELECT subject_id, AVG(enrolled_count) AS avg_enrolled
FROM courses
GROUP BY subject_id
HAVING AVG(enrolled_count) > 20;

-- Only graduated students, groups with at least 2 people
SELECT department_id, COUNT(*) AS graduated_count
FROM students
WHERE status = 'Graduated'
GROUP BY department_id
HAVING COUNT(*) >= 2;
```

### WHERE vs HAVING: Side-by-Side

| Aspect | WHERE | HAVING |
|--------|-------|--------|
| Operates on | Individual rows | Groups (after aggregation) |
| Used with | Always | Only with GROUP BY |
| Can reference | Any column | Only grouped columns or aggregates |
| Execution timing | Before grouping | After grouping |
| Performance impact | Reduces rows early (good!) | Filters after work is done |

```sql
-- OPTIMAL: filter with WHERE first, then group and filter groups
SELECT department_id, COUNT(*) AS cnt
FROM students
WHERE status = 'Active'          -- Reduce rows BEFORE grouping
GROUP BY department_id
HAVING COUNT(*) >= 2;            -- Then filter groups

-- SUBOPTIMAL: group everything, then filter
SELECT department_id, COUNT(*) AS cnt
FROM students                         -- Groups ALL students, including inactive
GROUP BY department_id
HAVING COUNT(*) >= 2                  -- Then throws away small groups
  AND EXISTS (SELECT 1 FROM students s2 WHERE s2.department_id = students.department_id AND s2.status = 'Active');
```

---

## Complex GROUP BY Patterns

### Multiple Aggregates Per Group
```sql
SELECT
  department_id,
  COUNT(*) AS total_students,
  COUNT(CASE WHEN status = 'Active' THEN 1 END) AS active_students,
  COUNT(CASE WHEN status = 'Graduated' THEN 1 END) AS graduated_students,
  ROUND(AVG(gpa), 2) AS avg_gpa,
  MIN(gpa) AS lowest_gpa,
  MAX(gpa) AS highest_gpa,
  COUNT(DISTINCT city) AS cities_represented
FROM students
GROUP BY department_id
ORDER BY total_students DESC;
```

### GROUP BY with JOIN
```sql
-- Department names with student counts
SELECT
  d.name AS department_name,
  COUNT(s.id) AS student_count,
  ROUND(AVG(s.gpa), 2) AS avg_gpa
FROM departments d
LEFT JOIN students s ON d.id = s.department_id
GROUP BY d.id, d.name
ORDER BY student_count DESC;
```

Note: We include `d.id` in GROUP BY alongside `d.name` to satisfy the rule (each non-aggregated SELECT column must be in GROUP BY). Including the primary key ensures uniqueness even if two departments share a name.

### GROUP BY with Date Components
```sql
-- Enrollments per month
SELECT
  strftime('%Y', enrollment_date) AS year,
  strftime('%m', enrollment_date) AS month,
  COUNT(*) AS enrollments
FROM enrollments
GROUP BY strftime('%Y', enrollment_date), strftime('%m', enrollment_date)
ORDER BY year, month;
```

---

## GROUPING SETS, CUBE, and ROLLUP (Conceptual)

Standard SQL supports powerful grouping extensions. SQLite doesn't support them natively, but you can simulate them:

### ROLLUP Simulation
```sql
-- Summaries by department, plus grand total
SELECT
  COALESCE(CAST(department_id AS TEXT), 'TOTAL') AS department,
  COUNT(*) AS student_count
FROM students
GROUP BY department_id

UNION ALL

SELECT 'TOTAL', COUNT(*) FROM students;
```

### CUBE Simulation (all combinations)
```sql
-- Summary by department alone
SELECT department_id, NULL AS status, COUNT(*) FROM students GROUP BY department_id
UNION ALL
-- Summary by status alone
SELECT NULL, status, COUNT(*) FROM students GROUP BY status
UNION ALL
-- Summary by both
SELECT department_id, status, COUNT(*) FROM students GROUP BY department_id, status;
```

---

## GROUP BY Best Practices

1. **Filter with WHERE before GROUP BY** — fewer rows to process
2. **Include primary keys in GROUP BY** alongside display columns — prevents ambiguity
3. **Alias aggregates** — makes the result self-documenting
4. **Always add ORDER BY** — GROUP BY doesn't guarantee order
5. **Use HAVING only for aggregate conditions** — don't replace WHERE with HAVING
6. **Avoid GROUP BY on TEXT columns** — slow on large datasets; consider integer IDs instead

---

## Common GROUP BY Mistakes

| Mistake | Error | Fix |
|---------|-------|-----|
| Selecting non-grouped column | `ERROR: column must appear in GROUP BY` | Add to GROUP BY or wrap in aggregate |
| Using HAVING instead of WHERE | Works but slow | Move non-aggregate filter to WHERE |
| Assuming GROUP BY order = output order | Unpredictable | Always add ORDER BY |
| Forgetting NULL forms its own group | Surprise extra row | Check for NULL group in results |

---

### Key Takeaways

1. **GROUP BY** collapses rows sharing identical values into one summary row per group
2. Every SELECT column must be in GROUP BY or wrapped in an aggregate
3. **HAVING** filters groups; **WHERE** filters rows — use both for maximum power
4. NULL values create their own group
5. Multiple GROUP BY columns create composite grouping keys
6. GROUP BY does NOT guarantee output order — always add ORDER BY
7. Simulate ROLLUP/CUBE with UNION ALL for multi-level summaries""",

print(f"Generated {len(NOTES)} notes so far")
# Write partial file to test, then we'll append the rest
with open(r'E:\products\logixzen\docs\desktop\data\_notes_part1.json', 'w', encoding='utf-8') as f:
    json.dump({'version': 2, 'notes': NOTES}, f, ensure_ascii=False, indent=2)
print("Part 1 written:", len(NOTES), "notes")
