import practiceDataRaw from "./practice-data.json";

type LogicalColumnType =
  "integer" | "text" | "real" | "boolean" | "datetime";

interface ForeignKeySpec {
  table: string;
  column: string;
  onDelete?: string;
}

export interface ColumnSpec {
  name: string;
  type: LogicalColumnType;
  nullable?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  defaultValue?: string | number | boolean;
  check?: string;
  references?: ForeignKeySpec;
}

export interface TableSpec {
  name: string;
  columns: ColumnSpec[];
  compositePrimaryKey?: string[];
  uniqueConstraints?: string[][];
  checks?: string[];
}

export const PRACTICE_TABLES: TableSpec[] = [
  {
    name: "departments",
    columns: [
      { name: "id", type: "integer", primaryKey: true },
      { name: "name", type: "text", unique: true },
      { name: "building", type: "text" },
      { name: "floor", type: "integer", defaultValue: 1 },
      { name: "head_teacher_id", type: "integer", nullable: true },
      { name: "budget", type: "real", defaultValue: 0.0 },
      {
        name: "created_at",
        type: "datetime",
        defaultValue: "(datetime('now'))",
      },
    ],
  },
  {
    name: "teachers",
    columns: [
      { name: "id", type: "integer", primaryKey: true },
      { name: "first_name", type: "text" },
      { name: "last_name", type: "text" },
      { name: "email", type: "text", unique: true },
      { name: "phone", type: "text", nullable: true },
      {
        name: "department_id",
        type: "integer",
        references: { table: "departments", column: "id" },
      },
      { name: "hire_date", type: "datetime", defaultValue: "(date('now'))" },
      { name: "salary", type: "real", defaultValue: 50000.0 },
      { name: "is_active", type: "integer", defaultValue: 1 },
    ],
  },
  {
    name: "subjects",
    columns: [
      { name: "id", type: "integer", primaryKey: true },
      { name: "code", type: "text", unique: true },
      { name: "name", type: "text" },
      { name: "description", type: "text", nullable: true },
      {
        name: "department_id",
        type: "integer",
        references: { table: "departments", column: "id" },
      },
      { name: "credits", type: "integer", defaultValue: 3 },
      {
        name: "prerequisite_subject_id",
        type: "integer",
        nullable: true,
        references: { table: "subjects", column: "id" },
      },
    ],
  },
  {
    name: "students",
    columns: [
      { name: "id", type: "integer", primaryKey: true },
      { name: "first_name", type: "text" },
      { name: "last_name", type: "text" },
      { name: "email", type: "text", unique: true },
      { name: "phone", type: "text", nullable: true },
      { name: "date_of_birth", type: "datetime" },
      {
        name: "gender",
        type: "text",
        nullable: true,
        check: "gender IN ('Male', 'Female', 'Other')",
      },
      { name: "address", type: "text", nullable: true },
      { name: "city", type: "text", nullable: true },
      { name: "state", type: "text", nullable: true },
      { name: "zip_code", type: "text", nullable: true },
      {
        name: "enrollment_date",
        type: "datetime",
        defaultValue: "(date('now'))",
      },
      {
        name: "status",
        type: "text",
        defaultValue: "'Active'",
        check: "status IN ('Active', 'Graduated', 'Suspended', 'Withdrawn')",
      },
      {
        name: "gpa",
        type: "real",
        nullable: true,
        check: "gpa >= 0.0 AND gpa <= 4.0",
      },
      {
        name: "department_id",
        type: "integer",
        references: { table: "departments", column: "id" },
      },
      {
        name: "advisor_teacher_id",
        type: "integer",
        nullable: true,
        references: { table: "teachers", column: "id" },
      },
    ],
  },
  {
    name: "courses",
    columns: [
      { name: "id", type: "integer", primaryKey: true },
      {
        name: "subject_id",
        type: "integer",
        references: { table: "subjects", column: "id" },
      },
      { name: "course_number", type: "text" },
      { name: "section", type: "text" },
      {
        name: "semester",
        type: "text",
        check: "semester IN ('Fall', 'Spring', 'Summer')",
      },
      { name: "year", type: "integer" },
      {
        name: "teacher_id",
        type: "integer",
        references: { table: "teachers", column: "id" },
      },
      { name: "room", type: "text", nullable: true },
      { name: "max_students", type: "integer", defaultValue: 30 },
      { name: "enrolled_count", type: "integer", defaultValue: 0 },
      { name: "schedule", type: "text", nullable: true },
    ],
  },
  {
    name: "enrollments",
    columns: [
      { name: "id", type: "integer", primaryKey: true },
      {
        name: "student_id",
        type: "integer",
        references: { table: "students", column: "id" },
      },
      {
        name: "course_id",
        type: "integer",
        references: { table: "courses", column: "id" },
      },
      {
        name: "enrollment_date",
        type: "datetime",
        defaultValue: "(date('now'))",
      },
      { name: "grade", type: "text", nullable: true },
      { name: "grade_points", type: "real", nullable: true },
      {
        name: "status",
        type: "text",
        defaultValue: "'Enrolled'",
        check: "status IN ('Enrolled', 'Dropped', 'Completed', 'In Progress')",
      },
      {
        name: "attendance_percentage",
        type: "real",
        nullable: true,
        check: "attendance_percentage >= 0 AND attendance_percentage <= 100",
      },
    ],
    uniqueConstraints: [["student_id", "course_id"]],
  },
  {
    name: "authors",
    columns: [
      { name: "id", type: "integer", primaryKey: true },
      { name: "first_name", type: "text" },
      { name: "last_name", type: "text" },
      { name: "bio", type: "text", nullable: true },
      { name: "nationality", type: "text", nullable: true },
      { name: "birth_year", type: "integer", nullable: true },
      { name: "death_year", type: "integer", nullable: true },
    ],
  },
  {
    name: "books",
    columns: [
      { name: "id", type: "integer", primaryKey: true },
      { name: "isbn", type: "text", unique: true },
      { name: "title", type: "text" },
      { name: "description", type: "text", nullable: true },
      { name: "published_year", type: "integer", nullable: true },
      { name: "price", type: "real", defaultValue: 0.0 },
      { name: "stock", type: "integer", defaultValue: 0 },
      { name: "category", type: "text" },
      {
        name: "subject_id",
        type: "integer",
        nullable: true,
        references: { table: "subjects", column: "id" },
      },
    ],
  },
  {
    name: "book_authors",
    columns: [
      {
        name: "book_id",
        type: "integer",
        references: { table: "books", column: "id", onDelete: "CASCADE" },
      },
      {
        name: "author_id",
        type: "integer",
        references: { table: "authors", column: "id", onDelete: "CASCADE" },
      },
    ],
    compositePrimaryKey: ["book_id", "author_id"],
  },
  {
    name: "loans",
    columns: [
      { name: "id", type: "integer", primaryKey: true },
      {
        name: "student_id",
        type: "integer",
        references: { table: "students", column: "id" },
      },
      {
        name: "book_id",
        type: "integer",
        references: { table: "books", column: "id" },
      },
      { name: "loan_date", type: "datetime", defaultValue: "(date('now'))" },
      { name: "due_date", type: "datetime" },
      { name: "return_date", type: "datetime", nullable: true },
      { name: "fine", type: "real", defaultValue: 0.0 },
      {
        name: "status",
        type: "text",
        defaultValue: "'Active'",
        check: "status IN ('Active', 'Returned', 'Overdue')",
      },
    ],
  },
  {
    name: "exams",
    columns: [
      { name: "id", type: "integer", primaryKey: true },
      {
        name: "course_id",
        type: "integer",
        references: { table: "courses", column: "id" },
      },
      { name: "exam_number", type: "integer" },
      { name: "title", type: "text" },
      { name: "exam_date", type: "datetime" },
      { name: "total_marks", type: "real" },
      { name: "duration_minutes", type: "integer" },
      {
        name: "exam_type",
        type: "text",
        check: "exam_type IN ('Quiz', 'Midterm', 'Final', 'Lab', 'Project')",
      },
    ],
  },
  {
    name: "exam_results",
    columns: [
      { name: "id", type: "integer", primaryKey: true },
      {
        name: "exam_id",
        type: "integer",
        references: { table: "exams", column: "id" },
      },
      {
        name: "student_id",
        type: "integer",
        references: { table: "students", column: "id" },
      },
      { name: "marks_obtained", type: "real" },
      { name: "submitted_at", type: "datetime", nullable: true },
    ],
    uniqueConstraints: [["exam_id", "student_id"]],
  },
  {
    name: "scholarships",
    columns: [
      { name: "id", type: "integer", primaryKey: true },
      { name: "name", type: "text" },
      { name: "description", type: "text", nullable: true },
      { name: "amount", type: "real" },
      { name: "GPA_requirement", type: "real", defaultValue: 0.0 },
      { name: "min_age", type: "integer", nullable: true },
      { name: "max_age", type: "integer", nullable: true },
      {
        name: "department_id",
        type: "integer",
        nullable: true,
        references: { table: "departments", column: "id" },
      },
      { name: "active", type: "integer", defaultValue: 1 },
    ],
  },
  {
    name: "student_scholarships",
    columns: [
      {
        name: "student_id",
        type: "integer",
        references: { table: "students", column: "id" },
      },
      {
        name: "scholarship_id",
        type: "integer",
        references: { table: "scholarships", column: "id" },
      },
      { name: "awarded_date", type: "datetime", defaultValue: "(date('now'))" },
      { name: "amount_awarded", type: "real" },
    ],
    compositePrimaryKey: ["student_id", "scholarship_id"],
  },
];

export const PRACTICE_DROP_ORDER: string[] = [
  "student_scholarships",
  "scholarships",
  "exam_results",
  "exams",
  "loans",
  "book_authors",
  "books",
  "authors",
  "enrollments",
  "courses",
  "students",
  "subjects",
  "teachers",
  "departments",
];

export const PRACTICE_TABLE_NAMES: string[] = PRACTICE_TABLES.map(
  (t) => t.name,
);

interface RawPracticeData {
  tables: Record<
    string,
    { columns: string[]; rows: Record<string, unknown>[] }
  >;
  deptHeadUpdates: Array<{ departmentId: number; headTeacherId: number }>;
}

const typedRaw = practiceDataRaw as unknown as RawPracticeData;

export const PRACTICE_SEED_DATA = typedRaw.tables;
export const DEPT_HEAD_UPDATES = typedRaw.deptHeadUpdates;
