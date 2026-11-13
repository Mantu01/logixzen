'use client'

import { useState } from 'react'
import { Terminal, Database, History, Play, Square } from 'lucide-react'
import SqlEditor from './SqlEditor'
import ResultPanel from './ResultPanel'
import SchemaPanel from './SchemaPanel'
import QueryHistoryPanel from './QueryHistoryPanel'
import SnippetPanel from './SnippetPanel'
import { usePlaygroundStore } from '@/stores/usePlaygroundStore'
import { useQueryHistoryStore } from '@/stores/useQueryHistoryStore'
import { useSnippetsStore } from '@/stores/useSnippetsStore'
import type { Snippet } from '@/stores/useSnippetsStore'
import type { QueryHistoryItem } from '@/stores/useQueryHistoryStore'

interface PlaygroundLayoutProps {
  initialSql?: string
  onInit: () => Promise<void>
  isLoading: boolean
  error: string | null
  isInitialized: boolean
}

export default function PlaygroundLayout({
  initialSql,
  onInit,
  isLoading,
  error,
  isInitialized,
}: PlaygroundLayoutProps): React.ReactElement {
  const [showSchema, setShowSchema] = useState(true)
  const [schemaCollapsed, setSchemaCollapsed] = useState(false)
  const [showBottom, setShowBottom] = useState(false)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [snippetsCollapsed, setSnippetsCollapsed] = useState(false)

  const sql = usePlaygroundStore((s) => s.sql)
  const setSql = usePlaygroundStore((s) => s.setSql)
  const lastResult = usePlaygroundStore((s) => s.results)
  const runQuery = usePlaygroundStore((s) => s.runQuery)
  const reset = usePlaygroundStore((s) => s.reset)

  const history = useQueryHistoryStore((s) => s.history)
  const addToHistory = useQueryHistoryStore((s) => s.addToHistory)
  const clearHistory = useQueryHistoryStore((s) => s.clearHistory)

  const snippets = useSnippetsStore((s) => s.snippets)
  const insertSnippet = useSnippetsStore((s) => s.insertSnippet)
  const deleteSnippet = useSnippetsStore((s) => s.deleteSnippet)
  const renameSnippet = useSnippetsStore((s) => s.renameSnippet)

  // Load initial SQL into editor
  useState(() => {
    if (initialSql) setSql(initialSql)
  })

  // Initialize database
  useState(() => {
    void onInit()
  })

  const handleRun = async () => {
    if (!sql.trim()) return
    await runQuery()
    // Add to history after query completes
    const { results } = usePlaygroundStore.getState()
    if (results?.[0]) {
      addToHistory(sql, !results[0].error)
    }
  }

  const handleClear = () => {
    setSql('')
    reset()
  }

  const handleInsertSnippet = (snippet: Snippet) => {
    setSql(snippet.sql)
  }

  const handleReuseHistory = (query: string) => {
    setSql(query)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="app-topbar">
        <div className="logo-area">
          <Terminal size={14} className="text-accent shrink-0" />
          <span className="font-mono text-sm font-semibold">playground</span>
        </div>
        <div className="topbar-actions gap-1">
          <button
            onClick={handleRun}
            disabled={!isInitialized || !sql.trim() || isLoading}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
            title="Ctrl+Enter to run"
          >
            <Play size={12} />
            {isLoading ? 'Running...' : 'Run'}
          </button>
          <button onClick={handleClear} className="btn btn-ghost btn-sm flex items-center gap-1.5">
            <Square size={12} /> Clear
          </button>
          <button
            onClick={() => setShowSchema(!showSchema)}
            className={`btn btn-ghost btn-sm flex items-center gap-1.5 ${showSchema ? 'bg-active text-accent' : ''}`}
            title="Toggle schema panel"
          >
            <Database size={12} /> Schema
          </button>
          <button
            onClick={() => setShowBottom(!showBottom)}
            className={`btn btn-ghost btn-sm flex items-center gap-1.5 ${showBottom ? 'bg-active text-accent' : ''}`}
            title="Toggle bottom panels"
          >
            <History size={12} /> History
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-error-dim border-b border-error text-xs font-mono text-error">
          {error}
        </div>
      )}

      {/* Editor + Results area */}
      <div className="app-body flex-1 overflow-hidden">
        {/* Schema panel */}
        {showSchema && (
          <div className={`${schemaCollapsed ? 'w-[52px]' : 'w-56'} border-r border-border shrink-0 bg-primary transition-all duration-200`}>
            <SchemaPanel collapsed={schemaCollapsed} onToggleCollapse={() => setSchemaCollapsed(!schemaCollapsed)} />
          </div>
        )}

        {/* Main content split */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* SQL Editor */}
          <div className="flex-1 border-b border-border overflow-hidden min-h-0">
            <div className="h-full flex flex-col">
              <div className="px-3 py-1.5 border-b border-border bg-secondary flex items-center justify-between shrink-0">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted">SQL</span>
                <span className="text-[10px] font-mono text-muted">{sql.split('\n').length} lines</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <SqlEditor value={sql} onChange={(v) => setSql(v ?? '')} onRun={handleRun} theme="vs-dark" />
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-hidden min-h-0">
            {lastResult !== null && lastResult.length > 0 ? (
              <ResultPanel results={lastResult} />
            ) : (
              <div className="h-full flex items-center justify-center bg-base">
                <div className="text-center">
                  <Terminal size={24} className="mx-auto mb-2 opacity-30 text-muted" />
                  <p className="text-sm font-mono text-muted">No query executed</p>
                  <p className="text-xs font-mono text-muted mt-1 opacity-60">Type SQL and press Run or Ctrl+Enter</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom collapsible panels */}
          {showBottom && (
            <div className="h-48 border-t border-border bg-primary shrink-0 overflow-hidden">
              <div className="flex h-full">
                <div className="flex-1 flex flex-col min-w-0 border-r border-border">
                  <QueryHistoryPanel
                    history={history}
                    onReuse={handleReuseHistory}
                    onClear={clearHistory}
                    collapsed={historyCollapsed}
                    onToggleCollapse={() => setHistoryCollapsed(!historyCollapsed)}
                  />
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                  <SnippetPanel
                    snippets={snippets}
                    onInsert={handleInsertSnippet}
                    onDelete={deleteSnippet}
                    onRename={renameSnippet}
                    collapsed={snippetsCollapsed}
                    onToggleCollapse={() => setSnippetsCollapsed(!snippetsCollapsed)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="app-statusbar px-3 py-1 flex items-center gap-3 text-[10px] font-mono text-muted">
        <span>{isInitialized ? 'Connected' : 'Not connected'}</span>
        <span className="opacity-40">|</span>
        <span>SQLite 3</span>
        <span className="opacity-40">|</span>
        <span>v0.2.0</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="opacity-40">Ctrl+Enter</span>
          <span className="opacity-40">Run</span>
        </span>
      </div>
    </div>
  )
}
