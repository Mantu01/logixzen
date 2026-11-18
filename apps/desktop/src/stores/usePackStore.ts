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
  PackIssue,
  PackKind,
  PackSummary,
  QuestionsPack,
} from "@/lib/packs/types";

export interface PackImportOutcome {
  ok: boolean;
  kind: PackKind;
  issues: PackIssue[];
  added: number;
  updated: number;
}

interface PackState {
  hydrated: boolean;
  databases: Dataset[];
  questions: Question[];
  topics: Topic[];
  notes: Note[];

  importFile: (text: string) => PackImportOutcome;
  addDataset: (dataset: Dataset) => void;
  removeDataset: (datasetId: string) => void;
  resetAll: () => void;
}

interface PersistedPacks {
  databases: Dataset[];
  questions: Question[];
  topics: Topic[];
  notes: Note[];
}

const EMPTY: PersistedPacks = {
  databases: [],
  questions: [],
  topics: [],
  notes: [],
};

export const usePackStore = create<PackState>()(
  persist(
    (set, get) => {
      const outcome = (
        ok: boolean,
        kind: PackKind,
        issues: PackIssue[],
        added: number,
        updated: number,
      ): PackImportOutcome => ({ ok, kind, issues, added, updated });

      return {
        hydrated: false,
        ...EMPTY,

        importFile: (text) => {
          const detected = parsePackFile(text);
          if (detected === null) {
            return outcome(
              false,
              "questions",
              [{ path: "$", message: "Invalid JSON" }],
              0,
              0,
            );
          }
          const { kind, result } = detected;
          if (!result.ok || result.data === null) {
            return outcome(false, kind, result.issues, 0, 0);
          }
          if (kind === "databases") {
            return applyDatabases(set, (result.data as DatabasePack).datasets);
          }
          if (kind === "questions") {
            const pack = result.data as QuestionsPack;
            return applyQuestions(set, pack.questions, pack.topics ?? []);
          }
          return applyNotes(set, (result.data as NotesPack).notes);
        },

        addDataset: (dataset) =>
          set((state) => ({
            databases: mergeById(state.databases, [dataset]).list,
          })),

        removeDataset: (datasetId) =>
          set((state) => ({
            databases: state.databases.filter((item) => item.id !== datasetId),
          })),

        resetAll: () => set({ ...EMPTY }),
      };

      function applyDatabases(
        setFn: (partial: Partial<PackState>) => void,
        incoming: Dataset[],
      ): PackImportOutcome {
        if (incoming.length === 0) {
          return outcome(
            false,
            "databases",
            [{ path: "datasets", message: "No datasets found" }],
            0,
            0,
          );
        }
        const { list, added, updated } = mergeById(get().databases, incoming);
        setFn({ databases: list });
        return outcome(true, "databases", [], added, updated);
      }

      function applyQuestions(
        setFn: (partial: Partial<PackState>) => void,
        incoming: Question[],
        incomingTopics: Topic[],
      ): PackImportOutcome {
        if (incoming.length === 0) {
          return outcome(
            false,
            "questions",
            [{ path: "questions", message: "No questions found" }],
            0,
            0,
          );
        }
        const merged = mergeById(get().questions, incoming);
        const topics =
          incomingTopics.length > 0
            ? mergeById(get().topics, incomingTopics).list
            : get().topics;
        setFn({ questions: merged.list, topics });
        return outcome(true, "questions", [], merged.added, merged.updated);
      }

      function applyNotes(
        setFn: (partial: Partial<PackState>) => void,
        incoming: Note[],
      ): PackImportOutcome {
        if (incoming.length === 0) {
          return outcome(
            false,
            "notes",
            [{ path: "notes", message: "No notes found" }],
            0,
            0,
          );
        }
        const merged = mergeById(get().notes, incoming);
        setFn({ notes: merged.list });
        return outcome(true, "notes", [], merged.added, merged.updated);
      }
    },
    {
      name: "logixzen-packs",
      version: 1,
      storage: createJSONStorage(() => nativeStorage),
      partialize: (state) => ({
        databases: state.databases,
        questions: state.questions,
        topics: state.topics,
        notes: state.notes,
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
}): PackSummary {
  return {
    databases: state.databases.length,
    questions: state.questions.length,
    topics:
      state.topics.length > 0
        ? state.topics.length
        : countUniqueTopics(state.questions),
    notes: state.notes.length,
  };
}

function countUniqueTopics(questions: Question[]): number {
  return new Set(questions.map((question) => question.topicId)).size;
}
