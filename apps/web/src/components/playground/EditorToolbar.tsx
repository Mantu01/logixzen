'use client'

import {
  ClipboardCopy,
  Download,
  Loader2,
  Play,
  RefreshCw,
  Columns as SchemaIcon,
} from 'lucide-react'
import { useState } from 'react'

interface EditorToolbarProps {
  sql: string
  isRunning: boolean
  onRun: () => void
  onClear: () => void
  onReset: () => void
  onExportCsv: () => void
  onExportJson: () => void
  onCopySql: () => void
  onToggleSchema: () => void
  isSchemaOpen: boolean
  resultCount?: number
  errorCount?: number
}

export function EditorToolbar({
  sql,
  isRunning,
  onRun,
  onClear,
  onExportCsv,
  onExportJson,
  onCopySql,
  onToggleSchema,
  isSchemaOpen,
  resultCount = 0,
  errorCount = 0,
}: EditorToolbarProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await onCopySql()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-secondary">
      {/* Run button */}
      <button
        onClick={onRun}
        disabled={isRunning || !sql.trim()}
        className="btn btn-primary btn-sm flex items-center gap-1.5"
      >
        {isRunning
          ? <Loader2 size={12} className="animate-spin" />
          : <Play size={12} />}
        Run
        <span className="text-[9px] opacity-60 ml-1">⌘↵</span>
      </button>

      {/* Clear */}
      <button
        onClick={onClear}
        className="btn btn-default btn-sm"
        disabled={isRunning}
      >
        <RefreshCw size={12} />
        Clear
      </button>

      {/* Toggle Schema */}
      <button
        onClick={onToggleSchema}
        className={`btn btn-default btn-sm ${isSchemaOpen ? 'border-accent text-accent' : ''}`}
        title="Toggle schema panel"
      >
        <SchemaIcon size={12} />
        Schema
      </button>

      <div className="flex-1" />

      {/* Stats badges */}
      {resultCount > 0 && (
        <span className="badge badge-accent">{resultCount} rows</span>
      )}
      {errorCount > 0 && (
        <span className="badge badge-error">{errorCount} err</span>
      )}

      <div className="w-px h-4 bg-border mx-1" />

      {/* Export */}
      <button
        onClick={onExportCsv}
        className="btn btn-ghost btn-xs"
        disabled={resultCount === 0}
        title="Export CSV"
      >
        <Download size={11} />
        CSV
      </button>
      <button
        onClick={onExportJson}
        className="btn btn-ghost btn-xs"
        disabled={resultCount === 0}
        title="Export JSON"
      >
        <Download size={11} />
        JSON
      </button>

      {/* Copy SQL */}
      <button
        onClick={handleCopy}
        className="btn btn-ghost btn-xs"
        title="Copy SQL"
      >
        <ClipboardCopy size={11} />
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
