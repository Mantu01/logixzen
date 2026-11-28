import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { nativeStorage } from "@/lib/native-storage";

export interface QueryFile {
  id: string;
  name: string;
  content: string;
  filePath?: string;
  savedContent?: string;
}

interface QueryFilesState {
  files: QueryFile[];
  activeId: string | null;
  newFile: (name?: string, content?: string) => string;
  openFile: (name: string, content: string, filePath?: string) => string;
  closeFile: (id: string) => void;
  renameFile: (id: string, name: string) => void;
  setContent: (id: string, content: string) => void;
  markSaved: (id: string, filePath?: string, name?: string) => void;
  setActive: (id: string) => void;
}

function nextName(existing: QueryFile[]): string {
  let index = 1;
  const taken = new Set(existing.map((file) => file.name));
  while (taken.has(`query_${index}.sql`)) index += 1;
  return `query_${index}.sql`;
}

function uniqueName(existing: QueryFile[], base: string): string {
  const taken = new Set(existing.map((file) => file.name));
  if (!taken.has(base)) return base;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let index = 2;
  while (taken.has(`${stem}_${index}${ext}`)) index += 1;
  return `${stem}_${index}${ext}`;
}

function normalizeSqlName(name: string): string {
  const trimmed = name.trim();
  return trimmed.toLowerCase().endsWith(".sql") ? trimmed : `${trimmed}.sql`;
}

export const useQueryFilesStore = create<QueryFilesState>()(
  persist(
    (set, get) => ({
      files: [{ id: "q1", name: "query_1.sql", content: "", savedContent: "" }],
      activeId: "q1",

      newFile: (name, content = "") => {
        const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const resolvedName = uniqueName(
          get().files,
          name !== undefined ? normalizeSqlName(name) : nextName(get().files),
        );
        const file: QueryFile = {
          id,
          name: resolvedName,
          content,
          savedContent: content,
        };
        set((state) => ({ files: [...state.files, file], activeId: id }));
        return id;
      },

      openFile: (name, content, filePath) => {
        if (filePath !== undefined) {
          const existing = get().files.find(
            (file) => file.filePath === filePath,
          );
          if (existing !== undefined) {
            set({ activeId: existing.id });
            return existing.id;
          }
        }
        const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const file: QueryFile = {
          id,
          name: uniqueName(get().files, name),
          content,
          filePath,
          savedContent: content,
        };
        set((state) => ({ files: [...state.files, file], activeId: id }));
        return id;
      },

      closeFile: (id) =>
        set((state) => {
          const index = state.files.findIndex((file) => file.id === id);
          if (index === -1) return state;
          const files = state.files.filter((file) => file.id !== id);
          const activeId =
            state.activeId === id
              ? (files[index - 1]?.id ?? files[index]?.id ?? null)
              : state.activeId;
          return { files, activeId };
        }),

      renameFile: (id, name) =>
        set((state) => {
          const trimmed = name.trim();
          if (trimmed.length === 0) return state;
          const normalized = normalizeSqlName(trimmed);
          const files = state.files.map((file) =>
            file.id === id
              ? {
                  ...file,
                  name: uniqueName(
                    state.files.filter((f) => f.id !== id),
                    normalized,
                  ),
                }
              : file,
          );
          return { files };
        }),

      setContent: (id, content) =>
        set((state) => ({
          files: state.files.map((file) =>
            file.id === id ? { ...file, content } : file,
          ),
        })),

      markSaved: (id, filePath, name) =>
        set((state) => ({
          files: state.files.map((file) => {
            if (file.id !== id) return file;
            const nextFileName =
              name !== undefined
                ? uniqueName(
                    state.files.filter((f) => f.id !== id),
                    name,
                  )
                : file.name;
            return {
              ...file,
              name: nextFileName,
              filePath: filePath ?? file.filePath,
              savedContent: file.content,
            };
          }),
        })),

      setActive: (id) => set({ activeId: id }),
    }),
    {
      name: "logixzen-query-files",
      version: 2,
      storage: createJSONStorage(() => nativeStorage),
      partialize: (state) => ({ files: state.files, activeId: state.activeId }),
      merge: (persisted, current) => {
        const value = (persisted ?? {}) as Partial<QueryFilesState>;
        if (!Array.isArray(value.files)) return current;
        if (value.files.length === 0) {
          return {
            ...current,
            files: [],
            activeId: null,
          };
        }
        const activeExists = value.files.some(
          (file) => file.id === value.activeId,
        );
        return {
          ...current,
          files: value.files,
          activeId: activeExists ? (value.activeId ?? null) : value.files[0].id,
        };
      },
    },
  ),
);
