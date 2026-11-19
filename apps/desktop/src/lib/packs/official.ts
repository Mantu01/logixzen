import type { PackKind } from "./types";

type ResourceLevel = "Beginner" | "Advanced" | "Complete";

export interface OfficialResource {
  id: string;
  title: string;
  level: ResourceLevel;
  summary: string;
  topics: string[] | null;
  noteCategories: string[] | null;
}

const PACK_BASE_URL =
  "https://raw.githubusercontent.com/Mantu01/logixzen/main/docs/desktop/data";

const RESOURCE_FILES: Record<PackKind, string> = {
  databases: "sample-databases.sql",
  questions: "sample-questions.json",
  notes: "sample-notes.json",
};

const BASICS_TOPICS = [
  "select-basics",
  "where-filters",
  "order-by",
  "aggregate-functions",
  "group-by",
  "joins",
  "string-functions",
  "date-functions",
  "null-handling",
  "dml",
  "ddl",
];

const INTERVIEW_TOPICS = [
  "subqueries",
  "set-operations",
  "window-functions",
  "cte",
  "index-constraints",
  "transactions",
  "advanced-select",
  "performance",
  "database-design",
  "real-world",
  "challenge",
];

export const OFFICIAL_RESOURCES: OfficialResource[] = [
  {
    id: "sql-basics",
    title: "Basic SQL",
    level: "Beginner",
    summary:
      "Read, filter, join and aggregate data. Covers SELECT through DDL with graded exercises and matching study notes.",
    topics: BASICS_TOPICS,
    noteCategories: [
      "SQL Basics",
      "Data Retrieval",
      "Aggregation",
      "Relational Queries",
      "Functions",
      "Data Manipulation",
      "Schema Design",
      "Data Quality",
    ],
  },
  {
    id: "sql-interview",
    title: "Interview SQL",
    level: "Advanced",
    summary:
      "Subqueries, window functions, CTEs, indexes and the puzzle-style queries asked in screening rounds.",
    topics: INTERVIEW_TOPICS,
    noteCategories: [
      "Advanced SQL",
      "Query Structure",
      "Optimization",
      "Practical Applications",
      "Advanced",
    ],
  },
  {
    id: "sql-complete",
    title: "SQL Complete",
    level: "Complete",
    summary:
      "The full library in a single install: every topic, every question and every note against the shared dataset.",
    topics: null,
    noteCategories: null,
  },
];

export async function fetchResourceFile(kind: PackKind): Promise<string> {
  const response = await fetch(`${PACK_BASE_URL}/${RESOURCE_FILES[kind]}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }
  return response.text();
}
