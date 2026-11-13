import { create } from 'zustand'
import type { TableInfo } from '@logixzen/shared/sql-engine'

interface SchemaState {
  schema: TableInfo[] | null
  isLoading: boolean
  error: string | null
  loadSchema: (data: TableInfo[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string) => void
  getTableColumns: (tableName: string) => TableInfo['columns'] | undefined
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  schema: null,
  isLoading: false,
  error: null,

  loadSchema: (data) => set({ schema: data, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),

  getTableColumns: (tableName) => {
    const { schema } = get()
    const table = schema?.find((t) => t.name === tableName)
    return table?.columns
  },
}))
