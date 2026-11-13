import { useState, useCallback } from 'react'
import type { ImportSource, ImportTarget, ImportResult } from './validation'
import { validateContent } from './validation'
import { readFileAsText } from '@/lib/fileReader'

interface UseImportManagerOptions {
  onImport?: (result: ImportResult) => void
}

export function useImportManager(options: UseImportManagerOptions = {}): {
  importFile: (source: ImportSource, target: ImportTarget, file: File) => Promise<ImportResult>
  importPaste: (source: ImportSource, target: ImportTarget, text: string) => Promise<ImportResult>
  isImporting: boolean
} {
  const [isImporting, setIsImporting] = useState<boolean>(false)
  const { onImport } = options

  const processImport = useCallback(
    async (source: ImportSource, target: ImportTarget, content: string): Promise<ImportResult> => {
      setIsImporting(true)

      try {
        const validation = validateContent(source, target, content)

        if (!validation.valid) {
          return { success: false, validation, importedItems: 0 }
        }

        let importedItems = 0

        if (target === 'progress') {
          const { useProgressStore } = await import('@/stores/useProgressStore')
          const { importProgress } = useProgressStore.getState()
          importProgress(content)
          importedItems = 1
        }

        const result: ImportResult = {
          success: true,
          validation,
          importedItems,
        }

        onImport?.(result)
        return result
      } finally {
        setIsImporting(false)
      }
    },
    [onImport]
  )

  const importFile = useCallback(
    async (source: ImportSource, target: ImportTarget, file: File): Promise<ImportResult> => {
      const content = await readFileAsText(file)
      return processImport(source, target, content)
    },
    [processImport]
  )

  const importPaste = useCallback(
    async (source: ImportSource, target: ImportTarget, text: string): Promise<ImportResult> => {
      return processImport(source, target, text)
    },
    [processImport]
  )

  return { importFile, importPaste, isImporting }
}
