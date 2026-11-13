import { useCallback } from 'react'
import { useSnippetsStore } from '@/stores/useSnippetsStore'

export function useSnippets() {
  const { snippets, addSnippet, updateSnippet, deleteSnippet } = useSnippetsStore()

  const createSnippet = useCallback(
    (title: string, sql: string) => {
      addSnippet({ title, sql })
    },
    [addSnippet]
  )

  const editSnippet = useCallback(
    (id: string, title: string, sql: string) => {
      updateSnippet(id, { title, sql })
    },
    [updateSnippet]
  )

  const removeSnippetById = useCallback(
    (id: string) => {
      deleteSnippet(id)
    },
    [deleteSnippet]
  )

  return {
    snippets,
    createSnippet,
    editSnippet,
    removeSnippetById,
  }
}
