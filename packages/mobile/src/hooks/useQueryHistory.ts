import { useCallback } from 'react'
import { useQueryHistoryStore } from '@/stores/useQueryHistoryStore'

export function useQueryHistory() {
  const { entries, addEntry, clearEntries, removeEntry } = useQueryHistoryStore()

  const markSuccess = useCallback(
    (sql: string) => {
      addEntry({ sql, success: true })
    },
    [addEntry]
  )

  const markError = useCallback(
    (sql: string) => {
      addEntry({ sql, success: false })
    },
    [addEntry]
  )

  return {
    entries,
    markSuccess,
    markError,
    clearEntries,
    removeEntry,
  }
}
