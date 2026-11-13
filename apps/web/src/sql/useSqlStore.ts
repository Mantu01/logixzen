// SQL Store - Zustand with persistence
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SqlResult, TableInfo } from '@logixzen/shared/sql-engine'
import { WebSqlEngine } from './WebSqlEngine'

interface SqlStoreState {
  engine: WebSqlEngine | null
  isInitialized: boolean
  isLoading: boolean
  lastResult: SqlResult[] | null
  schema: TableInfo[] | null
  error: string | null
}

interface SqlStoreActions {
  initialize: (setupSql?: string) => Promise<void>
  execute: (sql: string) => Promise<void>
  refreshSchema: () => Promise<void>
  close: () => Promise<void>
  loadDatabase: (data: Uint8Array) => Promise<void>
  serializeDatabase: () => Uint8Array | null
  clearError: () => void
}

type SqlStore = SqlStoreState & SqlStoreActions

export const useSqlStore = create<SqlStore>()(
  persist(
    (set, get) => ({
      engine: null,
      isInitialized: false,
      isLoading: false,
      lastResult: null,
      schema: null,
      error: null,

      initialize: async (setupSql?: string) => {
        set({ isLoading: true, error: null })
        try {
          const engine = new WebSqlEngine()
          await engine.initialize(setupSql)
          set({ engine, isInitialized: true, isLoading: false })
          await get().refreshSchema()
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          set({ error: message, isLoading: false, isInitialized: false })
        }
      },

      execute: async (sql: string) => {
        const { engine } = get()
        if (engine === null) {
          set({ error: 'Database not initialized', lastResult: null })
          return
        }
        set({ isLoading: true, error: null })
        try {
          const results = await engine.execute(sql)
          set({ lastResult: results, isLoading: false })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          set({ error: message, isLoading: false, lastResult: null })
        }
      },

      refreshSchema: async () => {
        const { engine } = get()
        if (engine === null) return
        try {
          const schema = await engine.getSchema()
          set({ schema })
        } catch {
          // Schema refresh is non-critical
        }
      },

      close: async () => {
        const { engine } = get()
        if (engine !== null) await engine.close()
        set({ engine: null, isInitialized: false, lastResult: null, schema: null, error: null })
      },

      loadDatabase: async (data: Uint8Array) => {
        set({ isLoading: true, error: null })
        try {
          const engine = new WebSqlEngine()
          await engine.deserialize(data)
          set({ engine, isInitialized: true, isLoading: false })
          await get().refreshSchema()
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          set({ error: message, isLoading: false, isInitialized: false })
        }
      },

      serializeDatabase: () => {
        const { engine } = get()
        if (engine === null) return null
        return engine.serialize()
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'logixzen_sql_store', partialize: (state) => ({ isInitialized: state.isInitialized }) }
  )
)
