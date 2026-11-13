import { create } from 'zustand'
import type { SqlResult, TableInfo } from '@logixzen/shared/sql-engine'
import { useSqlStore } from '@/sql/useSqlStore'

export interface PlaygroundState {
  // Core state
  sql: string
  isRunning: boolean
  results: SqlResult[]
  error: string | null
  schema: TableInfo[] | null
  activeDataset: string | null

  // UI state
  isSchemaPanelOpen: boolean
  activeTable?: string
  activeResultTab: number
  showTerminal: boolean

  // Actions
  setSql: (sql: string | ((prev: string) => string)) => void
  runQuery: () => Promise<void>
  reset: () => void
  setActiveDataset: (id: string) => void
  toggleSchemaPanel: () => void
  setActiveTable: (table?: string) => void
  exportResult: (format: 'csv' | 'json', index: number) => Promise<void>
  copyResult: (index: number) => Promise<void>
}

export const usePlaygroundStore = create<PlaygroundState>()((set, get) => ({
  sql: '',
  isRunning: false,
  results: [],
  error: null,
  schema: null,
  activeDataset: null,
  isSchemaPanelOpen: true,
  activeResultTab: 0,
  showTerminal: false,

  setSql: (sql: string | ((prev: string) => string)) => set((state) => ({ sql: typeof sql === 'function' ? sql(state.sql) : sql, error: null })),

  runQuery: async () => {
    const { sql } = get()
    if (!sql.trim()) return

    set({ isRunning: true, error: null })
    const execute = useSqlStore.getState().execute
    await execute(sql)

    const { lastResult, error } = useSqlStore.getState()
    set({
      isRunning: false,
      results: lastResult ?? [],
      error: error ?? null,
      activeResultTab: 0,
    })
  },

  reset: () => set({ sql: '', results: [], error: null, activeResultTab: 0 }),

  setActiveDataset: (id: string) => set({ activeDataset: id }),

  toggleSchemaPanel: () => set((s) => ({ isSchemaPanelOpen: !s.isSchemaPanelOpen })),

  setActiveTable: (table?: string) => set({ activeTable: table }),

  exportResult: async (format: 'csv' | 'json', index: number) => {
    const { results } = get()
    const result = results[index]
    if (!result) return

    const content =
      format === 'csv'
        ? formatCsv(result)
        : JSON.stringify(result.rows, null, 2)

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logixzen_export_${Date.now()}.${format === 'csv' ? 'csv' : 'json'}`
    a.click()
    URL.revokeObjectURL(url)
  },

  copyResult: async (index: number) => {
    const { results } = get()
    const result = results[index]
    if (!result) return

    const content = formatMarkdownTable(result)
    await navigator.clipboard.writeText(content)
  },
}))

function formatCsv(result: SqlResult): string {
  if (result.columns.length === 0) return ''
  const header = result.columns.join(',')
  const rows = result.rows.map((row) =>
    result.columns.map((col) => String(row[col] ?? '')).join(',')
  )
  return [header, ...rows].join('\n')
}

function formatMarkdownTable(result: SqlResult): string {
  if (result.columns.length === 0) return ''
  const header = `| ${result.columns.join(' | ')} |`
  const separator = `| ${result.columns.map(() => '---').join(' | ')} |`
  const rows = result.rows.map((row) =>
    `| ${result.columns.map((col) => String(row[col] ?? '')).join(' | ')} |`
  )
  return [header, separator, ...rows].join('\n')
}
