import { create } from 'zustand'

interface QueryHistoryEntry {
  id: string
  sql: string
  timestamp: number
  success: boolean
}

interface QueryHistoryState {
  entries: QueryHistoryEntry[]
  maxEntries: number
  addEntry: (entry: Omit<QueryHistoryEntry, 'id' | 'timestamp'>) => void
  clearEntries: () => void
  removeEntry: (id: string) => void
}

export const useQueryHistoryStore = create<QueryHistoryState>((set) => ({
  entries: [],
  maxEntries: 50,

  addEntry: (entry) =>
    set((state) => {
      const newEntry: QueryHistoryEntry = {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...entry,
        timestamp: Date.now(),
      }
      return {
        entries: [newEntry, ...state.entries].slice(0, state.maxEntries),
      }
    }),

  clearEntries: () => set({ entries: [] }),

  removeEntry: (id) =>
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    })),
}))
