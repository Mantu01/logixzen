import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Snippet {
  id: string;
  title: string;
  sql: string;
  createdAt: number;
  updatedAt: number;
}

interface SnippetsState {
  snippets: Snippet[];
  addSnippet: (input: { id?: string; title: string; sql: string }) => void;
  removeSnippet: (id: string) => void;
}

export const useSnippetsStore = create<SnippetsState>()(
  persist(
    (set) => ({
      snippets: [],
      addSnippet: (input) => {
        const now = Date.now();
        const snippet: Snippet = {
          id: input.id ?? `snippet-${now}`,
          title: input.title,
          sql: input.sql,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ snippets: [snippet, ...state.snippets] }));
      },
      removeSnippet: (id) =>
        set((state) => ({
          snippets: state.snippets.filter((snippet) => snippet.id !== id),
        })),
    }),
    { name: "logixzen_snippets" },
  ),
);
