import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Snippet {
  id: string
  title: string
  sql: string
  createdAt: number
}

interface SnippetsState {
  snippets: Snippet[]
  addSnippet: (snippet: Omit<Snippet, 'id' | 'createdAt'>) => void
  updateSnippet: (id: string, updates: Partial<Pick<Snippet, 'title' | 'sql'>>) => void
  deleteSnippet: (id: string) => void
  importSnippets: (snippets: Omit<Snippet, 'id' | 'createdAt'>[]) => void
  exportSnippets: () => Snippet[]
}

const initialSnippets: Snippet[] = []

export const useSnippetsStore = create<SnippetsState>()(
  persist(
    (set) => ({
      snippets: initialSnippets,

      addSnippet: (snippet) =>
        set((state) => ({
          snippets: [
            ...state.snippets,
            {
              ...snippet,
              id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              createdAt: Date.now(),
            },
          ],
        })),

      updateSnippet: (id, updates) =>
        set((state) => ({
          snippets: state.snippets.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),

      deleteSnippet: (id) =>
        set((state) => ({
          snippets: state.snippets.filter((s) => s.id !== id),
        })),

      importSnippets: (newSnippets) =>
        set((state) => {
          const imported = newSnippets.map((s) => ({
            ...s,
            id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: Date.now(),
          }))
          return { snippets: [...state.snippets, ...imported] }
        }),

      exportSnippets: (): Snippet[] => {
        const state = useSnippetsStore.getState()
        return state.snippets
      },
    }),
    {
      name: 'logixzen-snippets',
    }
  )
)
