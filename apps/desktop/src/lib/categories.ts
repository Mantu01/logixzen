import type { SubjectId } from "@/lib/subjects";

export interface Workspace {
  id: string;
  name: string;
  subjectId: SubjectId;
  description?: string;
  createdAt: string;
  order: number;
}

export interface QuestionCategory {
  id: string;
  name: string;
  order: number;
  workspaceId?: string;
}

export type CategoryAssignments = Record<string, string>;

export const DEFAULT_WORKSPACE_ID = "sql-default";

export const DEFAULT_WORKSPACE: Workspace = {
  id: DEFAULT_WORKSPACE_ID,
  name: "SQL Practice",
  subjectId: "sql",
  description: "Default workspace for SQL databases, questions, and study notes",
  createdAt: "2026-01-01T00:00:00.000Z",
  order: 0,
};

export const UNCATEGORIZED = "uncategorised";

export interface InstallCounts {
  databases: number;
  questions: number;
  notes: number;
}

export const ZERO_COUNTS: InstallCounts = {
  databases: 0,
  questions: 0,
  notes: 0,
};

export function categorySlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "category"
  );
}

export function workspaceSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "workspace"
  );
}

function sortedCategories(
  categories: QuestionCategory[],
): QuestionCategory[] {
  return [...categories].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name),
  );
}

export function workspaceCategories(
  categories: QuestionCategory[],
  workspaceId: string,
): QuestionCategory[] {
  return sortedCategories(
    categories.filter(
      (category) => (category.workspaceId ?? DEFAULT_WORKSPACE_ID) === workspaceId,
    ),
  );
}

export function questionsInCategory<T extends { id: string }>(
  questions: T[],
  assignments: CategoryAssignments,
  categoryId: string,
): T[] {
  if (categoryId === UNCATEGORIZED) {
    return questions.filter((question) => assignments[question.id] === undefined);
  }
  return questions.filter(
    (question) => assignments[question.id] === categoryId,
  );
}

export function categoryCounts(
  questions: Array<{ id: string }>,
  assignments: CategoryAssignments,
  categories: QuestionCategory[],
): Array<{ category: QuestionCategory | null; count: number }> {
  const counts = new Map<string, number>();
  let uncategorized = 0;
  for (const question of questions) {
    const id = assignments[question.id];
    if (id === undefined) {
      uncategorized += 1;
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const rows: Array<{ category: QuestionCategory | null; count: number }> =
    sortedCategories(categories).map((category) => ({
      category,
      count: counts.get(category.id) ?? 0,
    }));
  if (uncategorized > 0 || categories.length === 0) {
    rows.push({ category: null, count: uncategorized });
  }
  return rows;
}
