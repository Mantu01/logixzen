import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Dataset, Topic } from '@logixzen/shared/content'

interface ContentStoreState {
  datasets: Dataset[]
  topics: Topic[]
  isLoading: boolean
  error: string | null
  loaded: boolean
  setDatasets: (datasets: Dataset[]) => void
  setTopics: (topics: Topic[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string) => void
  setLoaded: (loaded: boolean) => void
  loadContent: () => Promise<void>
}

export const useContentStore = create<ContentStoreState>()(
  persist(
    (set, get) => ({
      datasets: [],
      topics: [],
      isLoading: false,
      error: null,
      loaded: false,

      setDatasets: (datasets) => set({ datasets }),
      setTopics: (topics) => set({ topics }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),
      setLoaded: (loaded) => set({ loaded }),

      loadContent: async () => {
        if (get().loaded) return
        set({ isLoading: true, error: null })
        try {
          const { loadAllDatasets, loadTopics } = await import('@logixzen/shared/content')
          const [datasets, topics] = await Promise.all([loadAllDatasets(), loadTopics()])
          set({ datasets, topics, isLoading: false, loaded: true, error: null })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          set({ isLoading: false, error: message, loaded: false })
        }
      },
    }),
    {
      name: 'logixzen-content',
      version: 1,
    }
  )
)
