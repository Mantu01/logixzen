import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { nativeStorage } from "@/lib/native-storage";
import { dateKey } from "@/lib/date-key";

export interface QuestionResult {
  timestamp: number;
  attempts: number;
  bestTimeMs: number;
  hintsUsed: number;
}

export interface StreakState {
  currentStreak: number;
  lastActiveDate: string;
  longestStreak: number;
}

export interface BadgeState {
  earned: Map<string, { timestamp: number }>;
}

export interface EditorSettings {
  editorFontSize: number;
  resultFontSize: number;
}

export interface ProgressExportFile {
  version: number;
  exportedAt: string;
  solvedQuestions: [string, QuestionResult][];
  totalPoints: number;
  streak: StreakState;
  activity: [string, number][];
  badges: [string, { timestamp: number }][];
  lastPosition: { topicId: string; questionId: string } | null;
}

interface ProgressState {
  solvedQuestions: Map<string, QuestionResult>;
  totalPoints: number;
  streak: StreakState;
  activity: Map<string, number>;
  lastPosition: { topicId: string; questionId: string } | null;
  badges: BadgeState;
  settings: EditorSettings;
}

interface ProgressActions {
  markSolved: (questionId: string, timeMs: number, hintsUsed: number) => number;
  addPoints: (points: number) => void;
  recordActivity: (delta: number) => void;
  updateStreak: () => number;
  earnBadge: (badgeId: string) => void;
  saveLastPosition: (topicId: string, questionId: string) => void;
  exportProgress: () => string;
  setEditorFontSize: (size: number) => void;
  setResultFontSize: (size: number) => void;
  resetProgress: () => void;
}

type ProgressStore = ProgressState & ProgressActions;

const EMPTY_STREAK: StreakState = { currentStreak: 0, lastActiveDate: "", longestStreak: 0 };
const PROGRESS_VERSION = 3;

function today(): string {
  return dateKey();
}

function dayBefore(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return dateKey(date);
}

function safeMap<T>(value: unknown, validate: (item: unknown) => boolean): Map<string, T> {
  const map = new Map<string, T>();
  if (!Array.isArray(value)) return map;
  for (const entry of value) {
    if (Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string" && validate(entry[1])) {
      map.set(entry[0], entry[1] as T);
    }
  }
  return map;
}

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => ({
      solvedQuestions: new Map(),
      totalPoints: 0,
      streak: EMPTY_STREAK,
      activity: new Map(),
      lastPosition: null,
      badges: { earned: new Map() },
      settings: { editorFontSize: 14, resultFontSize: 13 },

      markSolved: (questionId, timeMs, hintsUsed) => {
        const attempts = (get().solvedQuestions.get(questionId)?.attempts ?? 0) + 1;
        set((state) => {
          const next = new Map(state.solvedQuestions);
          const existing = next.get(questionId);
          next.set(questionId, {
            timestamp: Date.now(),
            attempts,
            bestTimeMs: Math.min(timeMs, existing?.bestTimeMs ?? Number.POSITIVE_INFINITY),
            hintsUsed,
          });
          return {
            solvedQuestions: next,
            activity: bumpActivity(state.activity),
          };
        });
        return attempts;
      },

      addPoints: (points) =>
        set((state) => ({ totalPoints: Math.max(0, state.totalPoints + points) })),

      recordActivity: (delta) =>
        set((state) => ({ activity: bumpActivity(state.activity, delta) })),

      updateStreak: () => {
        const state = get();
        const day = today();
        let nextStreak = state.streak.currentStreak;
        if (state.streak.lastActiveDate !== day) {
          const yesterday = dayBefore(1);
          nextStreak = state.streak.lastActiveDate === yesterday ? state.streak.currentStreak + 1 : 1;
          set((current) => ({
            streak: {
              currentStreak: nextStreak,
              lastActiveDate: day,
              longestStreak: Math.max(nextStreak, current.streak.longestStreak),
            },
          }));
        }
        return nextStreak;
      },

      earnBadge: (badgeId) =>
        set((state) => {
          if (state.badges.earned.has(badgeId)) return state;
          const earned = new Map(state.badges.earned);
          earned.set(badgeId, { timestamp: Date.now() });
          return { badges: { earned } };
        }),

      saveLastPosition: (topicId, questionId) => set({ lastPosition: { topicId, questionId } }),

      exportProgress: () => {
        const state = get();
        const file: ProgressExportFile = {
          version: PROGRESS_VERSION,
          exportedAt: new Date().toISOString(),
          solvedQuestions: Array.from(state.solvedQuestions.entries()),
          totalPoints: state.totalPoints,
          streak: state.streak,
          activity: Array.from(state.activity.entries()),
          badges: Array.from(state.badges.earned.entries()),
          lastPosition: state.lastPosition,
        };
        return JSON.stringify(file, null, 2);
      },

      setEditorFontSize: (editorFontSize) =>
        set((state) => ({ settings: { ...state.settings, editorFontSize } })),

      setResultFontSize: (resultFontSize) =>
        set((state) => ({ settings: { ...state.settings, resultFontSize } })),

      resetProgress: () =>
        set({
          solvedQuestions: new Map(),
          totalPoints: 0,
          streak: EMPTY_STREAK,
          activity: new Map(),
          badges: { earned: new Map() },
          lastPosition: null,
        }),
    }),
    {
      name: "logixzen-progress",
      version: PROGRESS_VERSION,
      storage: createJSONStorage(() => nativeStorage),
      partialize: (state) => ({
        solvedQuestions: Array.from(state.solvedQuestions.entries()),
        totalPoints: state.totalPoints,
        streak: state.streak,
        activity: Array.from(state.activity.entries()),
        lastPosition: state.lastPosition,
        badges: Array.from(state.badges.earned.entries()),
        settings: state.settings,
      }),
      merge: (persisted, current) => {
        const value = (persisted ?? {}) as Record<string, unknown>;
        return {
          ...current,
          solvedQuestions: safeMap<QuestionResult>(value.solvedQuestions, (item) => typeof item === "object" && item !== null),
          activity: safeMap<number>(value.activity, (item) => typeof item === "number"),
          badges: {
            earned: safeMap<{ timestamp: number }>(value.badges, (item) => typeof item === "object" && item !== null),
          },
          streak: (value.streak as StreakState | undefined) ?? current.streak,
          lastPosition: (value.lastPosition as ProgressState["lastPosition"] | undefined) ?? null,
          totalPoints: typeof value.totalPoints === "number" ? value.totalPoints : current.totalPoints,
          settings: { ...current.settings, ...((value.settings as Partial<EditorSettings> | undefined) ?? {}) },
        };
      },
      migrate: () => ({
        solvedQuestions: new Map(),
        totalPoints: 0,
        streak: EMPTY_STREAK,
        activity: new Map(),
        lastPosition: null,
        badges: { earned: new Map() },
        settings: { editorFontSize: 14, resultFontSize: 13 },
      }),
    },
  ),
);

function bumpActivity(activity: Map<string, number>, delta = 1): Map<string, number> {
  const next = new Map(activity);
  const day = today();
  next.set(day, Math.max(0, (next.get(day) ?? 0) + delta));
  return next;
}
