import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface QueryHistoryItem {
  id: string
  query: string
  timestamp: number
  success: boolean
}

interface QueryHistoryState {
  history: QueryHistoryItem[]
  addToHistory: (query: string, success: boolean) => void
  clearHistory: () => void
}

export const useQueryHistoryStore = create<QueryHistoryState>()(
  persist(
    (set) => ({
      history: [],

      addToHistory: (query: string, success: boolean) => {
        const item: QueryHistoryItem = {
          id: crypto.randomUUID(),
          query,
          timestamp: Date.now(),
          success,
        }
        set((s: QueryHistoryState) => ({ history: [item, ...s.history].slice(0, 50) }))
      },

      clearHistory: () => set({ history: [] }),
    }),
    { name: 'logixzen_query_history' }
  )
)
