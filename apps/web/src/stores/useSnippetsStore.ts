import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Snippet {
  id: string
  title: string
  sql: string
  createdAt: number
  updatedAt: number
}

interface SnippetsState {
  snippets: Snippet[]
  addSnippet: (snippet: Snippet) => void
  removeSnippet: (id: string) => void
  updateSnippet: (id: string, updates: Partial<Snippet>) => void
}

export const useSnippetsStore = create<SnippetsState>()(
  persist(
    (set) => ({
      snippets: [],

      addSnippet: (snippet: Snippet) =>
        set((s: SnippetsState) => ({ snippets: [snippet, ...s.snippets] })),

      removeSnippet: (id: string) =>
        set((s: SnippetsState) => ({ snippets: s.snippets.filter((sn: Snippet) => sn.id !== id) })),

      updateSnippet: (id: string, updates: Partial<Snippet>) =>
        set((s: SnippetsState) => ({
          snippets: s.snippets.map((sn: Snippet) =>
            sn.id === id ? { ...sn, ...updates, updatedAt: Date.now() } : sn
          ),
        })),
    }),
    { name: 'logixzen_snippets' }
  )
)
