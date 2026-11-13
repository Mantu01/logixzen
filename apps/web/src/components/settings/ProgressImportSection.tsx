import { useState, useCallback, useRef } from 'react'
import { useProgressStore } from '@/stores/useProgressStore'
import { readFileAsText } from '@/lib/fileReader'
import { Upload } from 'lucide-react'

export function ProgressImportSection(): React.ReactElement {
  const { importProgress } = useProgressStore()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError(null)
    setSuccess(false)
    try {
      const text = await readFileAsText(file)
      importProgress(text)
      setSuccess(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid progress file'
      setError(message)
    }
  }, [importProgress])

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-border rounded hover:bg-surface-alt transition-colors"
      >
        <Upload className="w-3.5 h-3.5" />
        Import Progress
      </button>
      {error && (
        <div className="text-xs text-error font-mono">{error}</div>
      )}
      {success && (
        <div className="text-xs text-success font-mono">Progress restored successfully</div>
      )}
    </div>
  )
}
