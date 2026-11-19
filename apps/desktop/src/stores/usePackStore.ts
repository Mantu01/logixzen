"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Dataset, Question, Topic } from "@logixzen/shared/content";
import { nativeStorage } from "@/lib/native-storage";
import { mergeById, parsePackFile } from "@/lib/packs/packs";
import type {
  DatabasePack,
  Note,
  NotesPack,
  PackFile,
  PackIssue,
  PackKind,
  PackSummary,
  QuestionsPack,
} from "@/lib/packs/types";
import {
  ZERO_COUNTS,
  categorySlug,
  type CategoryAssignments,
  type InstallCounts,
  type QuestionCategory,
} from "@/lib/categories";

export interface InstallOutcome {
  ok: boolean;
  issues: PackIssue[];
  counts: InstallCounts;
}

interface ContentBundle {
  databases?: Dataset[];
  questions?: Question[];
  topics?: Topic[];
  notes?: Note[];
}

type PersistedKey =
  | "databases"
  | "questions"
  | "topics"
  | "notes"
  | "categories"
  | "questionCategory"
  | "installedResources";

interface PackState {
  hydrated: boolean;
  databases: Dataset[];
  questions: Question[];
  topics: Topic[];
  notes: Note[];
  categories: QuestionCategory[];
  questionCategory: CategoryAssignments;
  installedResources: string[];

  importFile: (text: string) => InstallOutcome;
  installContent: (content: ContentBundle) => InstallOutcome;
  addDataset: (dataset: Dataset) => void;
  removeDataset: (datasetId: string) => void;
  markResourceInstalled: (resourceId: string) => void;
  createCategory: (name: string) => string | null;
  renameCategory: (categoryId: string, name: string) => void;
  removeCategory: (categoryId: string) => void;
  setQuestionCategory: (questionId: string, categoryId: string | null) => void;
  setQuestionCategories: (
    questionIds: string[],
    categoryId: string | null,
  ) => void;
  setNoteCategory: (noteId: string, category: string) => void;
  resetAll: () => void;
}

const EMPTY: Pick<PackState, PersistedKey> = {
  databases: [],
  questions: [],
  topics: [],
  notes: [],
  categories: [],
  questionCategory: {},
  installedResources: [],
};

const MAX_ISSUES = 25;

export const usePackStore = create<PackState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...EMPTY,

      importFile: (text) => {
        const detected = parsePackFile(text);
        if (detected === null) {
          return {
            ok: false,
            issues: [{ path: "$", message: "Invalid JSON" }],
            counts: ZERO_COUNTS,
          };
        }
        if (!detected.result.ok || detected.result.data === null) {
          return {
            ok: false,
            issues: detected.result.issues,
            counts: ZERO_COUNTS,
          };
        }
        return get().installContent(bundleOf(detected.kind, detected.result.data));
      },

      installContent: (content) => {
        const state = get();
        const issues = validateBundle(state, content);
        if (issues.length > 0) {
          return { ok: false, issues, counts: ZERO_COUNTS };
        }
        const questions = content.questions ?? [];
        const topics = deriveTopics(
          content.topics ? mergeById(state.topics, content.topics) : state.topics,
          questions,
        );
        set({
          databases: content.databases
            ? mergeById(state.databases, content.databases)
            : state.databases,
          questions: questions.length
            ? mergeById(state.questions, questions)
            : state.questions,
          topics,
          notes: content.notes
            ? mergeById(state.notes, content.notes)
            : state.notes,
        });
        return { ok: true, issues: [], counts: countsOf(content) };
      },

      addDataset: (dataset) =>
        set((state) => ({ databases: mergeById(state.databases, [dataset]) })),

      removeDataset: (datasetId) =>
        set((state) => ({
          databases: state.databases.filter((item) => item.id !== datasetId),
        })),

      markResourceInstalled: (resourceId) =>
        set((state) =>
          state.installedResources.includes(resourceId)
            ? state
            : { installedResources: [...state.installedResources, resourceId] },
        ),

      createCategory: (name) => {
        const trimmed = name.trim();
        if (trimmed.length === 0) return null;
        const categories = get().categories;
        let id = categorySlug(trimmed);
        if (categories.some((category) => category.id === id)) {
          id = `${id}-${categories.length + 1}`;
        }
        set({
          categories: [
            ...categories,
            { id, name: trimmed, order: categories.length },
          ],
        });
        return id;
      },

      renameCategory: (categoryId, name) =>
        set((state) => ({
          categories: state.categories.map((category) =>
            category.id === categoryId && name.trim().length > 0
              ? { ...category, name: name.trim() }
              : category,
          ),
        })),

      removeCategory: (categoryId) =>
        set((state) => ({
          categories: state.categories.filter(
            (category) => category.id !== categoryId,
          ),
          questionCategory: Object.fromEntries(
            Object.entries(state.questionCategory).filter(
              ([, assigned]) => assigned !== categoryId,
            ),
          ),
        })),

      setQuestionCategory: (questionId, categoryId) =>
        get().setQuestionCategories([questionId], categoryId),

      setQuestionCategories: (questionIds, categoryId) =>
        set((state) => {
          const next = { ...state.questionCategory };
          for (const questionId of questionIds) {
            if (categoryId === null) delete next[questionId];
            else next[questionId] = categoryId;
          }
          return { questionCategory: next };
        }),

      setNoteCategory: (noteId, category) =>
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId ? { ...note, category } : note,
          ),
        })),

      resetAll: () => set({ ...EMPTY }),
    }),
    {
      name: "logixzen-packs",
      version: 1,
      storage: createJSONStorage(() => nativeStorage),
      partialize: (state) => ({
        databases: state.databases,
        questions: state.questions,
        topics: state.topics,
        notes: state.notes,
        categories: state.categories,
        questionCategory: state.questionCategory,
        installedResources: state.installedResources,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          usePackStore.setState({ hydrated: true });
        }
      },
    },
  ),
);

export function summarizePacks(state: {
  databases: Dataset[];
  questions: Question[];
  topics: Topic[];
  notes: Note[];
  categories: QuestionCategory[];
}): PackSummary {
  return {
    databases: state.databases.length,
    questions: state.questions.length,
    topics:
      state.topics.length > 0
        ? state.topics.length
        : new Set(state.questions.map((question) => question.topicId)).size,
    notes: state.notes.length,
    categories: state.categories.length,
  };
}

function bundleOf(kind: PackKind, data: PackFile): ContentBundle {
  if (kind === "databases") {
    return { databases: (data as DatabasePack).datasets };
  }
  if (kind === "questions") {
    const pack = data as QuestionsPack;
    return { questions: pack.questions, topics: pack.topics ?? [] };
  }
  return { notes: (data as NotesPack).notes };
}

function countsOf(content: ContentBundle): InstallCounts {
  return {
    databases: content.databases?.length ?? 0,
    questions: content.questions?.length ?? 0,
    notes: content.notes?.length ?? 0,
  };
}

function validateBundle(state: PackState, content: ContentBundle): PackIssue[] {
  const issues: PackIssue[] = [];
  const push = (path: string, message: string): void => {
    if (issues.length < MAX_ISSUES) issues.push({ path, message });
  };

  for (const key of ["databases", "questions", "notes"] as const) {
    if (content[key]?.length === 0) push(key, `No ${key} found in this file`);
  }

  const datasetIds = new Set([
    ...state.databases.map((dataset) => dataset.id),
    ...(content.databases ?? []).map((dataset) => dataset.id),
  ]);
  for (const question of content.questions ?? []) {
    if (issues.length >= MAX_ISSUES) break;
    if (!datasetIds.has(question.datasetId)) {
      push(
        `questions.${question.id}.datasetId`,
        `Unknown dataset "${question.datasetId}" — install the matching database first`,
      );
    }
  }

  if (issues.length === MAX_ISSUES) {
    issues.push({ path: "questions", message: "Additional issues omitted" });
  }
  return issues;
}

function deriveTopics(existing: Topic[], questions: Question[]): Topic[] {
  const known = new Set(existing.map((topic) => topic.id));
  const missing = Array.from(
    new Set(questions.map((question) => question.topicId)),
  ).filter((id) => !known.has(id));
  if (missing.length === 0) return existing;
  return [
    ...existing,
    ...missing.map((id, index) => ({
      id,
      title: id.replace(/[-_]+/g, " "),
      order: existing.length + index,
    })),
  ];
}
