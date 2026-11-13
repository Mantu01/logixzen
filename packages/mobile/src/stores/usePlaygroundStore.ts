import { create } from 'zustand'
import type { SqlResult } from '@logixzen/shared/sql-engine'
import { ExpoSqlEngine } from '@/sql'

interface Dataset {
  id: string
  name: string
  tables: Array<{ name: string }>
}

interface PlaygroundState {
  datasets: Dataset[]
  activeDataset: string | null
  sql: string
  results: SqlResult[]
  isRunning: boolean
  error: string | null
  datasetsLoaded: boolean
  setSql: (sql: string) => void
  setActiveDataset: (id: string) => void
  runQuery: () => Promise<void>
  reset: () => void
  loadDatasets: (datasets: Dataset[]) => void
}

let _engine: ExpoSqlEngine | null = null

export const usePlaygroundStore = create<PlaygroundState>((set, get) => ({
  datasets: [],
  activeDataset: null,
  sql: '',
  results: [],
  isRunning: false,
  error: null,
  datasetsLoaded: false,

  setSql: (sql) => set({ sql }),

  setActiveDataset: (id) => set({ activeDataset: id }),

  runQuery: async () => {
    const { sql } = get()
    if (sql.trim().length === 0) return

    if (_engine === null) {
      _engine = new ExpoSqlEngine()
      await _engine.initialize()
    }

    set({ isRunning: true, error: null })
    try {
      const results = await _engine.execute(sql)
      set({ results, isRunning: false, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ results: [], isRunning: false, error: message })
    }
  },

  reset: () => {
    set({ sql: '', results: [], error: null })
  },

  loadDatasets: (datasets) => {
    set({ datasets, datasetsLoaded: true })
  },
}))
