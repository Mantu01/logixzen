'use client'

import { useState, useCallback, useRef } from 'react'
import { FileText, Database, Code } from 'lucide-react'
import { readFileAsText } from '@/lib/fileReader'
import type { ImportSource } from '@/features/import/validation'

interface ImportContentAreaProps {
  source: ImportSource
  onContent: (content: string) => void
}

export function ImportContentArea({ source, onContent }: ImportContentAreaProps): React.ReactElement {
  const [content, setContent] = useState<string>('')
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>): Promise<void> => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const text = await readFileAsText(file)
    setContent(text)
    onContent(text)
  }, [onContent])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const text = await readFileAsText(file)
    setContent(text)
    onContent(text)
  }, [onContent])

  if (source === 'json-paste') {
    return (
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); onContent(e.target.value) }}
        placeholder="Paste JSON content here..."
        className="w-full h-40 px-3 py-2 text-xs font-mono bg-background border border-border rounded text-foreground placeholder:text-muted outline-none focus:border-primary resize-none"
      />
    )
  }

  const acceptMap: Record<ImportSource, string> = {
    'sql-file': '.sql,.txt',
    'csv-file': '.csv',
    'sqlite-file': '.db,.sqlite,.sqlite3',
    'json-paste': '',
  } as Record<ImportSource, string>

  const iconMap: Record<ImportSource, React.ReactNode> = {
    'sql-file': <Code className="w-5 h-5" />,
    'csv-file': <FileText className="w-5 h-5" />,
    'sqlite-file': <Database className="w-5 h-5" />,
    'json-paste': <Code className="w-5 h-5" />,
  } as Record<ImportSource, React.ReactNode>

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => fileInputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptMap[source]}
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="text-muted mb-2">{iconMap[source]}</div>
      <div className="text-xs font-mono text-muted">
        {isDragging ? 'Drop file here' : 'Drop or click to browse'}
      </div>
      {content && (
        <div className="mt-2 text-[10px] text-success font-mono">
          ✓ {content.length.toLocaleString()} chars loaded
        </div>
      )}
    </div>
  )
}
