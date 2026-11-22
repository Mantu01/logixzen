import {
  DatasetSchema,
  QuestionSchema,
  TopicSchema,
} from "@logixzen/shared/content";
import type { Dataset, Question, Topic } from "@logixzen/shared/content";
import type {
  BundlePack,
  DatabasePack,
  Note,
  NotesPack,
  PackFile,
  PackIssue,
  PackKind,
  PackParseResult,
  QuestionsPack,
} from "./types";

const PACK_VERSION = 2;

function readObject(
  text: string,
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; issues: PackIssue[] } {
  if (text.trim().length === 0) {
    return { ok: false, issues: [{ path: "$", message: "File is empty" }] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      issues: [{ path: "$", message: `Invalid JSON: ${message}` }],
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      issues: [
        { path: "$", message: "Expected a JSON object with a version field" },
      ],
    };
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.version !== "number" || !Number.isInteger(record.version)) {
    return {
      ok: false,
      issues: [{ path: "version", message: "version must be an integer" }],
    };
  }
  return { ok: true, value: record };
}

function arrayAt(
  value: Record<string, unknown>,
  key: string,
): unknown[] | null {
  const item = value[key];
  if (!Array.isArray(item)) return null;
  return item;
}

function validateArray<T>(
  items: unknown[],
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  prefix: string,
  maxIssues = 25,
): { data: T[]; issues: PackIssue[] } {
  const data: T[] = [];
  const issues: PackIssue[] = [];
  items.forEach((item, index) => {
    const result = schema.safeParse(item);
    if (result.success && result.data !== undefined) {
      data.push(result.data);
      return;
    }
    if (issues.length < maxIssues) {
      issues.push({
        path: `${prefix}[${index}]`,
        message: `Item does not match the pack schema`,
      });
    } else if (issues.length === maxIssues) {
      issues.push({
        path: prefix,
        message: "Additional schema errors omitted",
      });
    }
  });
  return { data, issues };
}

function parseDatabasePack(
  value: Record<string, unknown>,
): PackParseResult<DatabasePack> {
  const items = arrayAt(value, "datasets");
  if (items === null) {
    return {
      ok: false,
      data: null,
      issues: [{ path: "datasets", message: "Missing datasets array" }],
    };
  }
  const { data, issues } = validateArray<Dataset>(
    items,
    DatasetSchema,
    "datasets",
  );
  return {
    ok: issues.length === 0 && data.length > 0,
    data: issues.length === 0 ? { version: 2, datasets: data } : null,
    issues,
  };
}

function parseQuestionsPack(
  value: Record<string, unknown>,
): PackParseResult<QuestionsPack> {
  const items = arrayAt(value, "questions");
  if (items === null) {
    return {
      ok: false,
      data: null,
      issues: [{ path: "questions", message: "Missing questions array" }],
    };
  }
  const questionResult = validateArray<Question>(
    items,
    QuestionSchema,
    "questions",
  );
  const topicItems = arrayAt(value, "topics");
  let topics: Topic[] = [];
  if (topicItems !== null) {
    const topicResult = validateArray<Topic>(topicItems, TopicSchema, "topics");
    topics = topicResult.data;
  }
  const ok =
    questionResult.issues.length === 0 && questionResult.data.length > 0;
  return {
    ok,
    data: ok
      ? {
          version: 2,
          topics: topics.length > 0 ? topics : undefined,
          questions: questionResult.data,
        }
      : null,
    issues: questionResult.issues,
  };
}

function parseNotesPack(
  value: Record<string, unknown>,
): PackParseResult<NotesPack> {
  const items = arrayAt(value, "notes");
  if (items === null) {
    return {
      ok: false,
      data: null,
      issues: [{ path: "notes", message: "Missing notes array" }],
    };
  }
  const noteSchema = {
    safeParse: (value: unknown) => {
      if (typeof value !== "object" || value === null)
        return { success: false as const };
      const note = value as Record<string, unknown>;
      if (
        typeof note.id !== "string" ||
        note.id.length === 0 ||
        typeof note.title !== "string" ||
        note.title.length === 0 ||
        typeof note.category !== "string" ||
        note.category.length === 0 ||
        typeof note.content !== "string" ||
        note.content.length === 0 ||
        !Array.isArray(note.tags)
      ) {
        return { success: false as const };
      }
      return {
        success: true as const,
        data: {
          id: note.id,
          title: note.title,
          category: note.category,
          content: note.content,
          tags: note.tags.filter(
            (tag): tag is string => typeof tag === "string",
          ),
        } satisfies Note,
      };
    },
  };
  const { data, issues } = validateArray<Note>(items, noteSchema, "notes");
  return {
    ok: issues.length === 0 && data.length > 0,
    data: issues.length === 0 ? { version: 2, notes: data } : null,
    issues,
  };
}

function parseBundlePack(
  value: Record<string, unknown>,
): PackParseResult<BundlePack> {
  const issues: PackIssue[] = [];
  let datasets: Dataset[] | undefined;
  let questions: Question[] | undefined;
  let topics: Topic[] | undefined;
  let notes: Note[] | undefined;

  const datasetItems = arrayAt(value, "datasets");
  if (datasetItems !== null) {
    const res = validateArray<Dataset>(datasetItems, DatasetSchema, "datasets");
    datasets = res.data;
    issues.push(...res.issues);
  }

  const questionItems = arrayAt(value, "questions");
  if (questionItems !== null) {
    const res = validateArray<Question>(questionItems, QuestionSchema, "questions");
    questions = res.data;
    issues.push(...res.issues);
  }

  const topicItems = arrayAt(value, "topics");
  if (topicItems !== null) {
    const res = validateArray<Topic>(topicItems, TopicSchema, "topics");
    topics = res.data;
    issues.push(...res.issues);
  }

  const noteItems = arrayAt(value, "notes");
  if (noteItems !== null) {
    const noteSchema = {
      safeParse: (val: unknown) => {
        if (typeof val !== "object" || val === null) return { success: false as const };
        const n = val as Record<string, unknown>;
        if (typeof n.id !== "string" || typeof n.title !== "string" || typeof n.content !== "string") {
          return { success: false as const };
        }
        return {
          success: true as const,
          data: {
            id: n.id,
            title: n.title,
            category: typeof n.category === "string" ? n.category : "General",
            content: n.content,
            tags: Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === "string") : [],
          } satisfies Note,
        };
      },
    };
    const res = validateArray<Note>(noteItems, noteSchema, "notes");
    notes = res.data;
    issues.push(...res.issues);
  }

  const hasAny = (datasets?.length ?? 0) > 0 || (questions?.length ?? 0) > 0 || (notes?.length ?? 0) > 0;
  return {
    ok: issues.length === 0 && hasAny,
    data: issues.length === 0 ? { version: 2, datasets, questions, topics, notes } : null,
    issues,
  };
}

function detectPackKind(value: unknown): PackKind | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const hasDatasets = Array.isArray(record.datasets);
  const hasQuestions = Array.isArray(record.questions);
  const hasNotes = Array.isArray(record.notes);
  if ((hasDatasets && hasQuestions) || (hasDatasets && hasNotes) || (hasQuestions && hasNotes)) {
    return "bundle";
  }
  if (hasDatasets) return "databases";
  if (hasQuestions) return "questions";
  if (hasNotes) return "notes";
  return null;
}

export function parsePackFile(
  text: string,
): { kind: PackKind; result: PackParseResult<PackFile> } | null {
  const probe = readObject(text);
  if (!probe.ok)
    return {
      kind: "questions",
      result: { ok: false, data: null, issues: probe.issues },
    };
  const kind = detectPackKind(probe.value);
  if (kind === null) {
    return {
      kind: "questions",
      result: {
        ok: false,
        data: null,
        issues: [
          {
            path: "$",
            message:
              "Unrecognized pack: expected a datasets, questions, or notes array",
          },
        ],
      },
    };
  }
  if (kind === "bundle")
    return { kind, result: parseBundlePack(probe.value) };
  if (kind === "databases")
    return { kind, result: parseDatabasePack(probe.value) };
  if (kind === "questions")
    return { kind, result: parseQuestionsPack(probe.value) };
  return { kind, result: parseNotesPack(probe.value) };
}

export function serializeQuestionsPack(
  topics: Topic[],
  questions: Question[],
): string {
  return JSON.stringify({ version: PACK_VERSION, topics, questions }, null, 2);
}

export function serializeNotesPack(notes: Note[]): string {
  return JSON.stringify({ version: PACK_VERSION, notes }, null, 2);
}

export function mergeById<T extends { id: string }>(
  current: T[],
  incoming: T[],
): T[] {
  const map = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values());
}
