import type { Dataset } from "@logixzen/shared/content";
import { ZERO_COUNTS } from "@/lib/categories";
import { buildDatasetFromSql, dbNameFromSql } from "@/lib/dataset-from-sql";
import { errorMessage } from "@/lib/utils";
import { useSqlStore } from "@/sql/useSqlStore";
import { usePackStore, type InstallOutcome } from "@/stores/usePackStore";
import { fetchResourceFile, type OfficialResource } from "./official";
import { parsePackFile } from "./packs";
import type {
  NotesPack,
  PackFile,
  PackIssue,
  PackKind,
  QuestionsPack,
} from "./types";

export interface ResourceInstallResult extends InstallOutcome {
  tables: number;
}

export async function installResource(
  resource: OfficialResource,
): Promise<ResourceInstallResult> {
  const files = await download();
  if (files === null) {
    return failure([{ path: "$", message: "Resource download failed" }]);
  }

  const questionFile = readPack<QuestionsPack>(files[1], "questions");
  if (questionFile.pack === null) return failure(questionFile.issues);
  const noteFile = readPack<NotesPack>(files[2], "notes");
  if (noteFile.pack === null) return failure(noteFile.issues);

  let dataset: Dataset;
  try {
    dataset = await buildDatasetFromSql(
      dbNameFromSql(files[0], "school"),
      files[0],
    );
  } catch (error) {
    return failure([{ path: "databases", message: errorMessage(error) }]);
  }

  const topicFilter = toFilter(resource.topics);
  const questions = questionFile.pack.questions.filter(
    (question) => topicFilter === null || topicFilter.has(question.topicId),
  );
  if (questions.length === 0) {
    return failure([
      { path: "questions", message: `No questions matched ${resource.title}` },
    ]);
  }
  const topics = (questionFile.pack.topics ?? []).filter(
    (topic) => topicFilter === null || topicFilter.has(topic.id),
  );

  const categoryFilter = toFilter(resource.noteCategories);
  const notes = noteFile.pack.notes.filter(
    (note) => categoryFilter === null || categoryFilter.has(note.category),
  );
  if (categoryFilter !== null && notes.length === 0) {
    return failure([
      { path: "notes", message: `No notes matched ${resource.title}` },
    ]);
  }

  const store = usePackStore.getState();
  const outcome = store.installContent({
    databases: [dataset],
    questions,
    topics,
    notes,
  });
  if (!outcome.ok) return { ...outcome, tables: 0 };

  await useSqlStore.getState().activateDataset(dataset.id);
  store.markResourceInstalled(resource.id);
  return { ...outcome, tables: dataset.tables.length };
}

function failure(issues: PackIssue[]): ResourceInstallResult {
  return { ok: false, issues, counts: ZERO_COUNTS, tables: 0 };
}

async function download(): Promise<[string, string, string] | null> {
  try {
    return await Promise.all([
      fetchResourceFile("databases"),
      fetchResourceFile("questions"),
      fetchResourceFile("notes"),
    ]);
  } catch {
    return null;
  }
}

function readPack<T extends PackFile>(
  text: string,
  kind: PackKind,
): { pack: T | null; issues: PackIssue[] } {
  const detected = parsePackFile(text);
  if (detected === null) {
    return { pack: null, issues: [{ path: kind, message: "Invalid JSON" }] };
  }
  if (detected.kind !== kind) {
    return {
      pack: null,
      issues: [{ path: kind, message: `Expected a ${kind} file` }],
    };
  }
  if (!detected.result.ok || detected.result.data === null) {
    return { pack: null, issues: detected.result.issues };
  }
  return { pack: detected.result.data as T, issues: [] };
}

function toFilter(values: string[] | null): Set<string> | null {
  return values === null ? null : new Set(values);
}
