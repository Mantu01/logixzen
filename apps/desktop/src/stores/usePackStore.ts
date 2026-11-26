"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Dataset, Question, Topic } from "@logixzen/shared/content";
import { nativeStorage } from "@/lib/native-storage";
import { mergeById, parsePackFile } from "@/lib/packs/packs";
import type {
  BundlePack,
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
  DEFAULT_WORKSPACE,
  DEFAULT_WORKSPACE_ID,
  ZERO_COUNTS,
  categorySlug,
  workspaceSlug,
  type CategoryAssignments,
  type InstallCounts,
  type QuestionCategory,
  type Workspace,
} from "@/lib/categories";
import type { SubjectId } from "@/lib/subjects";

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
  | "workspaces"
  | "activeWorkspaceId"
  | "databases"
  | "questions"
  | "topics"
  | "notes"
  | "categories"
  | "noteCategories"
  | "questionCategory"
  | "questionWorkspace"
  | "noteWorkspace"
  | "installedResources";

interface PackState {
  hydrated: boolean;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  databases: Dataset[];
  questions: Question[];
  topics: Topic[];
  notes: Note[];
  categories: QuestionCategory[];
  noteCategories: QuestionCategory[];
  questionCategory: CategoryAssignments;
  questionWorkspace: Record<string, string>;
  noteWorkspace: Record<string, string>;
  installedResources: string[];

  importFile: (text: string) => InstallOutcome;
  installContent: (content: ContentBundle) => InstallOutcome;
  addDataset: (dataset: Dataset) => void;
  removeDataset: (datasetId: string) => void;
  markResourceInstalled: (resourceId: string) => void;

  createWorkspace: (
    name: string,
    subjectId?: SubjectId,
    description?: string,
  ) => Workspace | null;
  renameWorkspace: (workspaceId: string, name: string, description?: string) => void;
  removeWorkspace: (workspaceId: string) => void;
  setActiveWorkspace: (workspaceId: string) => void;

  createCategory: (name: string, workspaceId?: string) => string | null;
  renameCategory: (categoryId: string, name: string) => void;
  reorderCategory: (categoryId: string, direction: "up" | "down") => void;
  removeCategory: (categoryId: string) => void;
  setQuestionCategory: (questionId: string, categoryId: string | null) => void;
  setQuestionCategories: (
    questionIds: string[],
    categoryId: string | null,
  ) => void;
  setQuestionWorkspace: (questionId: string, workspaceId: string) => void;
  addQuestion: (
    question: Question,
    categoryId?: string | null,
    workspaceId?: string,
  ) => void;
  removeQuestion: (questionId: string) => void;

  createNoteCategory: (name: string, workspaceId?: string) => string | null;
  renameNoteCategory: (
    oldName: string,
    newName: string,
    workspaceId?: string,
  ) => void;
  reorderNoteCategory: (categoryId: string, direction: "up" | "down") => void;
  removeNoteCategory: (name: string, workspaceId?: string) => void;
  setNoteCategory: (noteId: string, category: string) => void;
  setNoteWorkspace: (noteId: string, workspaceId: string) => void;
  addNote: (note: Note, workspaceId?: string) => void;
  updateNote: (note: Note) => void;
  removeNote: (noteId: string) => void;
  resetAll: () => void;
}

const EMPTY: Pick<PackState, PersistedKey> = {
  workspaces: [DEFAULT_WORKSPACE],
  activeWorkspaceId: DEFAULT_WORKSPACE_ID,
  databases: [],
  questions: [],
  topics: [],
  notes: [],
  categories: [],
  noteCategories: [],
  questionCategory: {},
  questionWorkspace: {},
  noteWorkspace: {},
  installedResources: [],
};

const MAX_ISSUES = 25;

function moveItemOrder(
  items: QuestionCategory[],
  categoryId: string,
  direction: "up" | "down",
): QuestionCategory[] {
  const ordered = [...items].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name),
  );
  const index = ordered.findIndex((item) => item.id === categoryId);
  if (index === -1) return items;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= ordered.length) return items;
  const target = ordered[index];
  const partner = ordered[swapIndex];
  ordered[index] = partner;
  ordered[swapIndex] = target;
  return ordered.map((item, idx) => ({ ...item, order: idx }));
}

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
        const activeWorkspaceId = state.activeWorkspaceId || DEFAULT_WORKSPACE_ID;
        const questions = content.questions ?? [];
        const notes = content.notes ?? [];
        const topics = deriveTopics(
          content.topics ? mergeById(state.topics, content.topics) : state.topics,
          questions,
        );
        const nextQuestionWorkspace = { ...state.questionWorkspace };
        for (const q of questions) {
          if (!nextQuestionWorkspace[q.id]) {
            nextQuestionWorkspace[q.id] = activeWorkspaceId;
          }
        }
        const nextNoteWorkspace = { ...state.noteWorkspace };
        const existingNoteCatNames = new Set(
          state.noteCategories
            .filter(
              (c) => (c.workspaceId ?? DEFAULT_WORKSPACE_ID) === activeWorkspaceId,
            )
            .map((c) => c.name.toLowerCase()),
        );
        const addedNoteCats: QuestionCategory[] = [];
        for (const n of notes) {
          if (!nextNoteWorkspace[n.id]) {
            nextNoteWorkspace[n.id] = activeWorkspaceId;
          }
          const catName = n.category.trim();
          if (catName && !existingNoteCatNames.has(catName.toLowerCase())) {
            existingNoteCatNames.add(catName.toLowerCase());
            addedNoteCats.push({
              id: `${activeWorkspaceId}-${categorySlug(catName)}`,
              name: catName,
              order: state.noteCategories.length + addedNoteCats.length,
              workspaceId: activeWorkspaceId,
            });
          }
        }

        set({
          databases: content.databases
            ? mergeById(state.databases, content.databases)
            : state.databases,
          questions: questions.length
            ? mergeById(state.questions, questions)
            : state.questions,
          topics,
          notes: notes.length ? mergeById(state.notes, notes) : state.notes,
          noteCategories:
            addedNoteCats.length > 0
              ? [...state.noteCategories, ...addedNoteCats]
              : state.noteCategories,
          questionWorkspace: nextQuestionWorkspace,
          noteWorkspace: nextNoteWorkspace,
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

      createWorkspace: (name, subjectId = "sql", description) => {
        const trimmed = name.trim();
        if (trimmed.length === 0) return null;
        const workspaces = get().workspaces;
        let id = workspaceSlug(trimmed);
        if (workspaces.some((workspace) => workspace.id === id)) {
          id = `${id}-${workspaces.length + 1}`;
        }
        const workspace: Workspace = {
          id,
          name: trimmed,
          subjectId,
          description: description?.trim() || undefined,
          createdAt: new Date().toISOString(),
          order: workspaces.length,
        };
        set({
          workspaces: [...workspaces, workspace],
          activeWorkspaceId: workspace.id,
        });
        return workspace;
      },

      renameWorkspace: (workspaceId, name, description) =>
        set((state) => ({
          workspaces: state.workspaces.map((workspace) =>
            workspace.id === workspaceId && name.trim().length > 0
              ? {
                  ...workspace,
                  name: name.trim(),
                  description:
                    description !== undefined
                      ? description.trim() || undefined
                      : workspace.description,
                }
              : workspace,
          ),
        })),

      removeWorkspace: (workspaceId) =>
        set((state) => {
          if (state.workspaces.length <= 1 || workspaceId === DEFAULT_WORKSPACE_ID) {
            return state;
          }
          const remaining = state.workspaces.filter((w) => w.id !== workspaceId);
          const fallbackId = remaining[0]?.id ?? DEFAULT_WORKSPACE_ID;
          const nextQuestionWorkspace = { ...state.questionWorkspace };
          for (const [qId, wId] of Object.entries(nextQuestionWorkspace)) {
            if (wId === workspaceId) nextQuestionWorkspace[qId] = fallbackId;
          }
          const nextNoteWorkspace = { ...state.noteWorkspace };
          for (const [nId, wId] of Object.entries(nextNoteWorkspace)) {
            if (wId === workspaceId) nextNoteWorkspace[nId] = fallbackId;
          }
          return {
            workspaces: remaining,
            activeWorkspaceId:
              state.activeWorkspaceId === workspaceId
                ? fallbackId
                : state.activeWorkspaceId,
            categories: state.categories.filter(
              (c) => (c.workspaceId ?? DEFAULT_WORKSPACE_ID) !== workspaceId,
            ),
            noteCategories: state.noteCategories.filter(
              (c) => (c.workspaceId ?? DEFAULT_WORKSPACE_ID) !== workspaceId,
            ),
            questionWorkspace: nextQuestionWorkspace,
            noteWorkspace: nextNoteWorkspace,
          };
        }),

      setActiveWorkspace: (workspaceId) =>
        set((state) =>
          state.workspaces.some((w) => w.id === workspaceId)
            ? { activeWorkspaceId: workspaceId }
            : state,
        ),

      createCategory: (name, workspaceId) => {
        const trimmed = name.trim();
        if (trimmed.length === 0) return null;
        const targetWorkspaceId =
          workspaceId ?? (get().activeWorkspaceId || DEFAULT_WORKSPACE_ID);
        const categories = get().categories;
        let id = categorySlug(trimmed);
        if (categories.some((category) => category.id === id)) {
          id = `${id}-${categories.length + 1}`;
        }
        set({
          categories: [
            ...categories,
            {
              id,
              name: trimmed,
              order: categories.length,
              workspaceId: targetWorkspaceId,
            },
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

      reorderCategory: (categoryId, direction) =>
        set((state) => ({
          categories: moveItemOrder(state.categories, categoryId, direction),
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

      setQuestionWorkspace: (questionId, workspaceId) =>
        set((state) => ({
          questionWorkspace: {
            ...state.questionWorkspace,
            [questionId]: workspaceId,
          },
        })),

      addQuestion: (question, categoryId, workspaceId) =>
        set((state) => {
          const nextQuestions = mergeById(state.questions, [question]);
          const nextCategories = { ...state.questionCategory };
          if (categoryId) nextCategories[question.id] = categoryId;
          const targetWorkspace =
            workspaceId ?? (state.activeWorkspaceId || DEFAULT_WORKSPACE_ID);
          return {
            questions: nextQuestions,
            questionCategory: nextCategories,
            questionWorkspace: {
              ...state.questionWorkspace,
              [question.id]: targetWorkspace,
            },
          };
        }),

      removeQuestion: (questionId) =>
        set((state) => {
          const nextCategories = { ...state.questionCategory };
          delete nextCategories[questionId];
          const nextWorkspaces = { ...state.questionWorkspace };
          delete nextWorkspaces[questionId];
          return {
            questions: state.questions.filter((item) => item.id !== questionId),
            questionCategory: nextCategories,
            questionWorkspace: nextWorkspaces,
          };
        }),

      createNoteCategory: (name, workspaceId) => {
        const trimmed = name.trim();
        if (trimmed.length === 0) return null;
        const targetWorkspaceId =
          workspaceId ?? (get().activeWorkspaceId || DEFAULT_WORKSPACE_ID);
        const existing = get().noteCategories;
        const dup = existing.find(
          (c) =>
            (c.workspaceId ?? DEFAULT_WORKSPACE_ID) === targetWorkspaceId &&
            c.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (dup) return dup.id;
        let id = `${targetWorkspaceId}-${categorySlug(trimmed)}`;
        if (existing.some((c) => c.id === id)) {
          id = `${id}-${existing.length + 1}`;
        }
        set({
          noteCategories: [
            ...existing,
            {
              id,
              name: trimmed,
              order: existing.length,
              workspaceId: targetWorkspaceId,
            },
          ],
        });
        return id;
      },

      renameNoteCategory: (oldName, newName, workspaceId) =>
        set((state) => {
          const trimmed = newName.trim();
          if (!trimmed) return state;
          const targetWorkspaceId =
            workspaceId ?? (state.activeWorkspaceId || DEFAULT_WORKSPACE_ID);
          return {
            noteCategories: state.noteCategories.map((c) =>
              (c.workspaceId ?? DEFAULT_WORKSPACE_ID) === targetWorkspaceId &&
              c.name === oldName
                ? { ...c, name: trimmed }
                : c,
            ),
            notes: state.notes.map((n) =>
              (state.noteWorkspace[n.id] ?? DEFAULT_WORKSPACE_ID) ===
                targetWorkspaceId && n.category === oldName
                ? { ...n, category: trimmed }
                : n,
            ),
          };
        }),

      reorderNoteCategory: (categoryId, direction) =>
        set((state) => ({
          noteCategories: moveItemOrder(
            state.noteCategories,
            categoryId,
            direction,
          ),
        })),

      removeNoteCategory: (name, workspaceId) =>
        set((state) => {
          const targetWorkspaceId =
            workspaceId ?? (state.activeWorkspaceId || DEFAULT_WORKSPACE_ID);
          return {
            noteCategories: state.noteCategories.filter(
              (c) =>
                !(
                  (c.workspaceId ?? DEFAULT_WORKSPACE_ID) === targetWorkspaceId &&
                  c.name === name
                ),
            ),
            notes: state.notes.map((n) =>
              (state.noteWorkspace[n.id] ?? DEFAULT_WORKSPACE_ID) ===
                targetWorkspaceId && n.category === name
                ? { ...n, category: "General" }
                : n,
            ),
          };
        }),

      setNoteCategory: (noteId, category) =>
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === noteId ? { ...note, category } : note,
          ),
        })),

      setNoteWorkspace: (noteId, workspaceId) =>
        set((state) => ({
          noteWorkspace: {
            ...state.noteWorkspace,
            [noteId]: workspaceId,
          },
        })),

      addNote: (note, workspaceId) =>
        set((state) => {
          const targetWorkspace =
            workspaceId ?? (state.activeWorkspaceId || DEFAULT_WORKSPACE_ID);
          const trimmedCat = note.category.trim() || "General";
          const hasCat = state.noteCategories.some(
            (c) =>
              (c.workspaceId ?? DEFAULT_WORKSPACE_ID) === targetWorkspace &&
              c.name.toLowerCase() === trimmedCat.toLowerCase(),
          );
          const nextCats = hasCat
            ? state.noteCategories
            : [
                ...state.noteCategories,
                {
                  id: `${targetWorkspace}-${categorySlug(trimmedCat)}-${state.noteCategories.length + 1}`,
                  name: trimmedCat,
                  order: state.noteCategories.length,
                  workspaceId: targetWorkspace,
                },
              ];
          return {
            notes: mergeById(state.notes, [{ ...note, category: trimmedCat }]),
            noteCategories: nextCats,
            noteWorkspace: {
              ...state.noteWorkspace,
              [note.id]: targetWorkspace,
            },
          };
        }),

      updateNote: (note) =>
        set((state) => ({
          notes: state.notes.map((existing) =>
            existing.id === note.id ? note : existing,
          ),
        })),

      removeNote: (noteId) =>
        set((state) => {
          const nextWorkspaces = { ...state.noteWorkspace };
          delete nextWorkspaces[noteId];
          return {
            notes: state.notes.filter((item) => item.id !== noteId),
            noteWorkspace: nextWorkspaces,
          };
        }),

      resetAll: () => set({ ...EMPTY }),
    }),
    {
      name: "logixzen-packs",
      version: 2,
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== "object") {
          return { ...EMPTY };
        }
        const record = persisted as Record<string, unknown>;
        const workspaces = Array.isArray(record.workspaces) && record.workspaces.length > 0
          ? (record.workspaces as Workspace[])
          : [DEFAULT_WORKSPACE];
        const activeWorkspaceId =
          typeof record.activeWorkspaceId === "string" && record.activeWorkspaceId.length > 0
            ? record.activeWorkspaceId
            : DEFAULT_WORKSPACE_ID;
        const rawNotes = Array.isArray(record.notes) ? (record.notes as Note[]) : [];
        const existingNoteCats = Array.isArray(record.noteCategories)
          ? (record.noteCategories as QuestionCategory[])
          : [];
        const derivedNoteCats = [...existingNoteCats];
        const seen = new Set(derivedNoteCats.map((c) => c.name.toLowerCase()));
        for (const note of rawNotes) {
          const cat = note.category?.trim();
          if (cat && !seen.has(cat.toLowerCase())) {
            seen.add(cat.toLowerCase());
            derivedNoteCats.push({
              id: `${DEFAULT_WORKSPACE_ID}-${categorySlug(cat)}`,
              name: cat,
              order: derivedNoteCats.length,
              workspaceId: DEFAULT_WORKSPACE_ID,
            });
          }
        }
        return {
          ...EMPTY,
          ...record,
          workspaces,
          activeWorkspaceId,
          noteCategories: derivedNoteCats,
        };
      },
      storage: createJSONStorage(() => nativeStorage),
      partialize: (state) => ({
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
        databases: state.databases,
        questions: state.questions,
        topics: state.topics,
        notes: state.notes,
        categories: state.categories,
        noteCategories: state.noteCategories,
        questionCategory: state.questionCategory,
        questionWorkspace: state.questionWorkspace,
        noteWorkspace: state.noteWorkspace,
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
  if (kind === "bundle") {
    const pack = data as BundlePack;
    return {
      databases: pack.datasets,
      questions: pack.questions,
      topics: pack.topics ?? [],
      notes: pack.notes,
    };
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
