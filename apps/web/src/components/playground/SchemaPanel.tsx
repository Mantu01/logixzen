'use client'

import { ChevronDown, ChevronRight, Columns as ColumnIcon, Key, Table as TableIcon } from 'lucide-react'
import { useState } from 'react'
import type { ColumnInfo, TableInfo } from '@logixzen/shared/sql-engine'
import { useSqlStore } from '@/sql/useSqlStore'
import { useSchemaStore } from '@/stores/useSchemaStore'

interface SchemaPanelProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export default function SchemaPanel({ collapsed = false, onToggleCollapse }: SchemaPanelProps): React.ReactElement {
  const schema = useSqlStore(s => s.schema)
  const selectedTable = useSchemaStore(s => s.selectedTable)
  const toggleTable = useSchemaStore(s => s.toggleTable)
  const setSelectedTable = useSchemaStore(s => s.setSelectedTable)

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-muted hover-text transition-fast border-b border-border"
        title="Expand schema panel"
      >
        <TableIcon size={13} />
        <span>Schema</span>
        <ChevronRight size={11} className="ml-auto" />
      </button>
    )
  }

  const tables: TableInfo[] = schema ?? []

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary shrink-0">
        <TableIcon size={12} className="text-muted" />
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted flex-1">
          Schema
        </span>
        <button onClick={onToggleCollapse} className="text-muted hover-text transition-fast" title="Collapse">
          <ChevronRight size={11} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {tables.length === 0 ? (
          <div className="px-2 py-4 text-xs text-muted text-center font-mono">No tables loaded<br /><span className="opacity-60">Run a query first</span></div>
        ) : (
          tables.map(table => (
            <SchemaTableNode
              key={table.name}
              table={table}
              isActive={selectedTable === table.name}
              onSelect={(name) => { toggleTable(name); setSelectedTable(name) }}
            />
          ))
        )}
      </div>
    </div>
  )
}

function SchemaTableNode({
  table,
  isActive,
  onSelect,
}: {
  table: TableInfo
  isActive: boolean
  onSelect: (name: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        onClick={() => { setExpanded(p => !p); onSelect(table.name) }}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-mono hover-bg transition-fast ${
          isActive ? 'bg-active text-accent' : 'text-secondary'
        }`}
      >
        {expanded ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
        <TableIcon size={12} className="shrink-0 opacity-70" />
        <span className="truncate font-medium flex-1 text-left">{table.name}</span>
        <span className="text-[9px] opacity-50">{table.columns.length}</span>
      </button>

      {expanded && (
        <div className="ml-4 border-l border-border/50">
          {table.columns.map((col: ColumnInfo) => (
            <div
              key={col.name}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-muted"
            >
              {col.primaryKey
                ? <Key size={10} className="text-warning shrink-0" />
                : <ColumnIcon size={10} className="shrink-0" />}
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
