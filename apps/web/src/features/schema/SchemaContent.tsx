'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Columns as ColumnIcon, Key, Table as TableIcon, Upload } from 'lucide-react'
import type { TableInfo, ColumnInfo } from '@logixzen/shared/sql-engine'
import { useSqlStore } from '@/sql/useSqlStore'
import { useSchemaStore } from '@/stores/useSchemaStore'
import { PageHeader } from '@/components/PageHeader'
import { ImportDialog } from '@/components/import/ImportDialog'
import SchemaDiagram from '@/components/schema/SchemaDiagram'
import { inferRelations } from '@/stores/useSchemaStore'

interface TableNodeProps {
  table: TableInfo
  isActive: boolean
  onSelect: (name: string) => void
}

function TableNode({ table, isActive, onSelect }: TableNodeProps) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div>
      <button
        onClick={() => { onSelect(table.name); setExpanded(p => !p) }}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-mono hover-bg transition-fast ${isActive ? 'bg-active text-accent' : 'text-secondary'}`}
      >
        {expanded ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
        <TableIcon size={12} className="opacity-70 shrink-0" />
        <span className="truncate font-medium flex-1 text-left">{table.name}</span>
        <span className="text-[9px] opacity-50">{table.columns.length}</span>
      </button>
      {expanded && (
        <div className="ml-4 border-l border-border/50">
          {table.columns.map(col => (
            <div key={col.name} className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono text-muted">
              {col.primaryKey ? <Key size={10} className="text-warning shrink-0" /> : <ColumnIcon size={10} className="shrink-0" />}
              <span className={col.primaryKey ? 'text-warning' : ''}>{col.name}</span>
              <span className="ml-auto text-[9px] opacity-50">{col.type || 'TEXT'}</span>
              {col.notNull && <span className="text-[8px] text-error/70">NOT NULL</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SchemaContent(): React.ReactElement {
  const schema = useSqlStore(s => s.schema)
  const selectedTable = useSchemaStore(s => s.selectedTable)
  const searchQuery = useSchemaStore(s => s.searchQuery)
  const setSelectedTable = useSchemaStore(s => s.setSelectedTable)
  const setSearchQuery = useSchemaStore(s => s.setSearchQuery)
  const toggleTable = useSchemaStore(s => s.toggleTable)
  const activeTab = useSchemaStore(s => s.activeTab)
  const setActiveTab = useSchemaStore(s => s.setActiveTab)
  const [importOpen, setImportOpen] = useState(false)

  const filtered = schema?.filter(t =>
    !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? []

  const selectedTableInfo = schema?.find(t => t.name === selectedTable)

  const relations = inferRelations(schema ?? [])

  const handleNavigateToPlayground = (name: string) => {
    window.location.href = `/playground?sql=${encodeURIComponent(`SELECT * FROM "${name}"`)}`
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader titleOverride="Schema" />
      <div className="page-content flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-border mb-4 shrink-0">
          <button
            onClick={() => setActiveTab('explorer')}
            className={`px-4 py-2 text-xs font-mono border-b-2 transition-fast ${activeTab === 'explorer' ? 'border-accent text-accent' : 'border-transparent text-muted hover-text'}`}
          >
            Schema Explorer
          </button>
          <button
            onClick={() => setActiveTab('diagram')}
            className={`px-4 py-2 text-xs font-mono border-b-2 transition-fast ${activeTab === 'diagram' ? 'border-accent text-accent' : 'border-transparent text-muted hover-text'}`}
          >
            ER Diagram
          </button>
        </div>

        {activeTab === 'explorer' ? (
          <div className="flex-1 flex overflow-hidden rounded-sm border border-border">
            {/* Sidebar */}
            <div className="w-60 border-r border-border flex flex-col shrink-0 bg-primary">
              <div className="p-2 border-b border-border">
                <input
                  type="text"
                  placeholder="Search tables..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input input-sm w-full"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                {filtered.length === 0 ? (
                  <div className="p-4 text-xs text-muted text-center font-mono">
                    No tables loaded<br /><span className="text-[9px] opacity-60">Run a query in Playground first</span>
                  </div>
                ) : filtered.map(t => (
                  <TableNode key={t.name} table={t} isActive={selectedTable === t.name} onSelect={(n) => { toggleTable(n); setSelectedTable(n) }} />
                ))}
              </div>
            </div>

            {/* Detail panel */}
            <div className="flex-1 flex flex-col overflow-hidden bg-base">
              {!selectedTableInfo ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <TableIcon size={32} className="mx-auto mb-2 opacity-30 text-muted" />
                    <p className="text-sm font-mono text-muted">Select a table to inspect</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-primary shrink-0">
                    <div>
                      <h2 className="font-mono text-sm font-semibold">{selectedTableInfo.name}</h2>
                      <p className="text-xs text-muted mt-0.5">{selectedTableInfo.columns.length} columns</p>
                    </div>
                    <button onClick={() => handleNavigateToPlayground(selectedTableInfo.name)} className="btn btn-primary btn-sm">Run SELECT *</button>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="w-10">#</th><th>Column</th><th>Type</th><th>Constraints</th><th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(searchQuery
                          ? selectedTableInfo.columns.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          : selectedTableInfo.columns
                        ).map((col, idx) => (
                          <tr key={col.name} className="transition-fast hover-bg">
                            <td className="text-muted opacity-60">{idx + 1}</td>
                            <td className="font-medium">
                              <div className="flex items-center gap-1.5">
                                {col.primaryKey && <Key size={11} className="text-warning shrink-0" />}
                                <span>{col.name}</span>
                              </div>
                            </td>
                            <td><span className="badge badge-muted">{col.type || 'TEXT'}</span></td>
                            <td className="flex items-center gap-1">
                              {col.notNull && <span className="badge badge-warning text-[9px]">NN</span>}
                              {col.primaryKey && <span className="badge badge-success text-[9px]">PK</span>}
                            </td>
                            <td className="text-muted text-xs">-</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selectedTableInfo.sampleRows.length > 0 && (
                    <div className="border-t border-border shrink-0">
                      <div className="px-4 py-2 bg-secondary border-b border-border font-mono text-xs font-semibold uppercase tracking-wider text-muted">
                        Sample Data
                      </div>
                      <div className="overflow-auto max-h-40">
                        <table className="data-table">
                          <thead><tr>{selectedTableInfo.columns.map(c => <th key={c.name}>{c.name}</th>)}</tr></thead>
                          <tbody>
                            {selectedTableInfo.sampleRows.map((row, i) => (
                              <tr key={i} className="transition-fast hover-bg">
                                {selectedTableInfo.columns.map(c => (
                                  <td key={c.name} className="max-w-[140px]">
                                    {row[c.name] !== undefined && row[c.name] !== null
                                      ? String(row[c.name])
                                      : <span className="text-muted italic">null</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <span className="text-xs font-mono text-muted">{schema?.length ?? 0} tables detected</span>
              {relations.length > 0 && <span className="text-xs font-mono text-muted">· {relations.length} relationship{(relations.length !== 1 ? 's' : '')} inferred</span>}
              <span className="text-xs font-mono text-muted opacity-40">Drag tables to rearrange · Relations auto-detected from _id columns</span>
              <button className="btn btn-default btn-xs ml-auto" onClick={() => setImportOpen(true)}>
                <Upload size={11} /> Import Schema
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SchemaDiagram tables={schema ?? []} relations={relations} />
            </div>
          </div>
        )}
      </div>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
